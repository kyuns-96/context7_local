#!/bin/bash

# Re-embedding automation script for local_context7
# Regenerate embeddings for library documentation with different providers
# Usage: ./scripts/re-embed.sh [options]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DB_FILE=""
PROVIDER=""
API_KEY=""
MODEL=""
LIBRARY_ID=""
FORCE=false
CONFIG_FILE=""
INTERACTIVE=true

# Function to print help
print_help() {
    cat << 'EOF'
Re-embedding Automation Script for local_context7

USAGE:
    ./scripts/re-embed.sh [options]

DESCRIPTION:
    Regenerate vector embeddings for library documentation using different
    embedding providers (local or OpenAI). Supports interactive and CLI modes.

OPTIONS:
    -p, --provider PROVIDER         Embedding provider: 'local' or 'openai'
                                   (default: interactive prompt)
    
    -k, --api-key KEY               API key for external providers (OpenAI)
                                   (can also use EMBEDDING_API_KEY env var)
    
    -m, --model MODEL               Model name to use
                                   Local default: Xenova/all-MiniLM-L6-v2
                                   OpenAI options: text-embedding-3-small (1536d)
                                                   text-embedding-3-large (3072d)
    
    -l, --library-id ID             Re-embed specific library only
                                   Format: /org/project
                                   Example: /vercel/next.js
                                   (default: re-embed all libraries)
    
    -d, --db DATABASE               Path to SQLite database file
                                   (default: ./docs.db)
    
    -c, --config CONFIG_FILE        Load settings from config file
                                   (overrides individual flags except --force)
    
    -f, --force                     Force regeneration even if embeddings exist
                                   (default: false)
    
    -h, --help                      Show this help message

EXAMPLES:

    # Interactive mode (prompts for settings)
    ./scripts/re-embed.sh

    # Quick re-embed with OpenAI (non-interactive)
    ./scripts/re-embed.sh --provider openai --api-key sk-... --force

    # Re-embed specific library locally
    ./scripts/re-embed.sh --provider local --library-id /vercel/next.js --force

    # Use config file for settings
    ./scripts/re-embed.sh --config config.json --force

    # Custom database path
    ./scripts/re-embed.sh --db custom.db --provider local

ENVIRONMENT VARIABLES:
    
    EMBEDDING_PROVIDER              Provider to use (overridable by --provider)
    EMBEDDING_API_KEY               API key (overridable by --api-key)
    EMBEDDING_MODEL                 Model name (overridable by --model)

PERFORMANCE NOTES:

    Local Provider (Xenova/all-MiniLM-L6-v2):
    - Speed: ~2-3 hours for 244k snippets
    - Cost: Free
    - Requirements: ~23MB model (cached locally)
    - Best for: Air-gapped environments, privacy-sensitive deployments

    OpenAI Provider (text-embedding-3-small):
    - Speed: ~1-2 hours (network dependent)
    - Cost: ~$1-2 for full database
    - Requirements: API key + internet connection
    - Best for: Production deployments, higher quality embeddings

WORKFLOW:

    1. Validates database exists
    2. Checks bun installation
    3. Counts current embeddings
    4. Prompts for provider (if interactive)
    5. Validates provider settings
    6. Runs vectorize command with progress reporting
    7. Reports statistics (time taken, snippets processed)

For more information, see README.md section "Re-embedding in Different Environments"

EOF
}

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to validate database exists
validate_database() {
    local db=$1
    if [[ ! -f "$db" ]]; then
        print_error "Database file not found: $db"
        echo "Please run 'bun run src/cli/index.ts ingest' first to create the database."
        exit 1
    fi
    print_success "Database found: $db"
}

# Function to check if bun is installed
check_bun() {
    if ! command -v bun &> /dev/null; then
        print_error "Bun is not installed or not in PATH"
        echo "Install Bun from https://bun.sh"
        exit 1
    fi
    print_success "Bun is installed"
}

# Function to count embeddings in database
count_embeddings() {
    local db=$1
    local library_id=$2
    
    if [[ -z "$library_id" ]]; then
        # Count all embeddings
        sqlite3 "$db" "SELECT COUNT(*) FROM snippets WHERE embedding IS NOT NULL AND embedding != 'null';" 2>/dev/null || echo "0"
    else
        # Count embeddings for specific library
        sqlite3 "$db" "SELECT COUNT(*) FROM snippets WHERE library_id = '$library_id' AND embedding IS NOT NULL AND embedding != 'null';" 2>/dev/null || echo "0"
    fi
}

# Function to count total snippets
count_snippets() {
    local db=$1
    local library_id=$2
    
    if [[ -z "$library_id" ]]; then
        # Count all snippets
        sqlite3 "$db" "SELECT COUNT(*) FROM snippets;" 2>/dev/null || echo "0"
    else
        # Count snippets for specific library
        sqlite3 "$db" "SELECT COUNT(*) FROM snippets WHERE library_id = '$library_id';" 2>/dev/null || echo "0"
    fi
}

# Function to validate provider settings
validate_provider_settings() {
    local provider=$1
    local api_key=$2
    
    case "$provider" in
        local)
            print_info "Using local provider: Xenova/all-MiniLM-L6-v2"
            return 0
            ;;
        openai)
            if [[ -z "$api_key" ]]; then
                print_error "OpenAI provider requires API key"
                print_info "Provide via --api-key flag or EMBEDDING_API_KEY environment variable"
                exit 1
            fi
            if [[ ! "$api_key" =~ ^sk- ]]; then
                print_warning "API key doesn't look like an OpenAI key (should start with 'sk-')"
            fi
            print_info "Using OpenAI provider"
            return 0
            ;;
        *)
            print_error "Unknown provider: $provider"
            echo "Supported providers: local, openai"
            exit 1
            ;;
    esac
}

# Function to parse arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--provider)
                PROVIDER="$2"
                INTERACTIVE=false
                shift 2
                ;;
            -k|--api-key)
                API_KEY="$2"
                shift 2
                ;;
            -m|--model)
                MODEL="$2"
                shift 2
                ;;
            -l|--library-id)
                LIBRARY_ID="$2"
                shift 2
                ;;
            -d|--db)
                DB_FILE="$2"
                shift 2
                ;;
            -c|--config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -h|--help)
                print_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Function to load config file
load_config_file() {
    local config=$1
    
    if [[ ! -f "$config" ]]; then
        print_error "Config file not found: $config"
        exit 1
    fi
    
    print_info "Loading configuration from: $config"
    
    # Parse JSON config (simple extraction)
    PROVIDER=$(grep -o '"provider"[[:space:]]*:[[:space:]]*"[^"]*"' "$config" | head -1 | cut -d'"' -f4)
    API_KEY=$(grep -o '"apiKey"[[:space:]]*:[[:space:]]*"[^"]*"' "$config" | head -1 | cut -d'"' -f4)
    MODEL=$(grep -o '"model"[[:space:]]*:[[:space:]]*"[^"]*"' "$config" | head -1 | cut -d'"' -f4)
    
    if [[ -n "$PROVIDER" ]]; then
        print_success "Loaded provider: $PROVIDER"
    fi
    if [[ -n "$API_KEY" ]]; then
        print_success "Loaded API key (${#API_KEY} chars)"
    fi
    if [[ -n "$MODEL" ]]; then
        print_success "Loaded model: $MODEL"
    fi
}

# Function for interactive mode
interactive_mode() {
    echo ""
    print_info "Starting interactive re-embedding setup"
    echo ""
    
    # Database selection
    read -p "Database file path (default: ./docs.db): " -r input_db
    DB_FILE="${input_db:-.docs.db}"
    
    # Provider selection
    echo ""
    print_info "Available embedding providers:"
    echo "  1) Local (Xenova/all-MiniLM-L6-v2) - Free, no API key needed"
    echo "  2) OpenAI (text-embedding-3-small/large) - Requires API key"
    echo ""
    read -p "Choose provider (1-2): " -r provider_choice
    
    case "$provider_choice" in
        1)
            PROVIDER="local"
            ;;
        2)
            PROVIDER="openai"
            read -p "Enter OpenAI API key (sk-...): " -r API_KEY
            ;;
        *)
            print_error "Invalid choice: $provider_choice"
            exit 1
            ;;
    esac
    
    # Library selection
    echo ""
    read -p "Library ID to re-embed (leave empty for all): " -r input_library
    LIBRARY_ID="$input_library"
    
    # Force option
    echo ""
    read -p "Force regeneration even if embeddings exist? (y/N): " -r force_choice
    if [[ "$force_choice" =~ ^[Yy]$ ]]; then
        FORCE=true
    fi
    
    echo ""
}

# Function to estimate time
estimate_time() {
    local snippet_count=$1
    local provider=$2
    
    if [[ "$provider" == "local" ]]; then
        # Local: ~0.03 seconds per snippet (based on 244k in ~2-3 hours)
        local seconds=$((snippet_count * 30 / 1000))
        local hours=$((seconds / 3600))
        local minutes=$(((seconds % 3600) / 60))
        
        if [[ $hours -gt 0 ]]; then
            echo "${hours}h ${minutes}m"
        elif [[ $minutes -gt 0 ]]; then
            echo "${minutes}m"
        else
            echo "< 1m"
        fi
    else
        # OpenAI: ~0.015 seconds per snippet (faster due to batching)
        local seconds=$((snippet_count * 15 / 1000))
        local hours=$((seconds / 3600))
        local minutes=$(((seconds % 3600) / 60))
        
        if [[ $hours -gt 0 ]]; then
            echo "${hours}h ${minutes}m"
        elif [[ $minutes -gt 0 ]]; then
            echo "${minutes}m"
        else
            echo "< 1m"
        fi
    fi
}

# Function to build vectorize command
build_vectorize_command() {
    local cmd="bun run src/cli/index.ts vectorize --db \"$DB_FILE\""
    
    if $FORCE; then
        cmd="$cmd --force"
    fi
    
    if [[ -n "$LIBRARY_ID" ]]; then
        cmd="$cmd --library-id $LIBRARY_ID"
    fi
    
    if [[ -n "$PROVIDER" ]]; then
        cmd="$cmd --embedding-provider $PROVIDER"
    fi
    
    if [[ -n "$API_KEY" ]]; then
        cmd="$cmd --embedding-api-key $API_KEY"
    fi
    
    if [[ -n "$MODEL" ]]; then
        cmd="$cmd --embedding-model $MODEL"
    fi
    
    if [[ -n "$CONFIG_FILE" ]]; then
        cmd="$cmd --config \"$CONFIG_FILE\""
    fi
    
    echo "$cmd"
}

# Main execution
main() {
    echo ""
    print_info "local_context7 - Re-embedding Automation Script"
    echo ""
    
    # Parse command line arguments
    parse_arguments "$@"
    
    # Load config file if specified
    if [[ -n "$CONFIG_FILE" ]]; then
        load_config_file "$CONFIG_FILE"
    fi
    
    # Use default database if not specified
    if [[ -z "$DB_FILE" ]]; then
        DB_FILE="./docs.db"
    fi
    
    # Check environment variables if not provided via flags
    if [[ -z "$PROVIDER" ]] && [[ -n "$EMBEDDING_PROVIDER" ]]; then
        PROVIDER="$EMBEDDING_PROVIDER"
    fi
    if [[ -z "$API_KEY" ]] && [[ -n "$EMBEDDING_API_KEY" ]]; then
        API_KEY="$EMBEDDING_API_KEY"
    fi
    
    # Interactive mode if no provider specified
    if [[ -z "$PROVIDER" ]] && $INTERACTIVE; then
        interactive_mode
    fi
    
    # Validate environment
    echo ""
    check_bun
    validate_database "$DB_FILE"
    
    # Get statistics before re-embedding
    echo ""
    print_info "Checking embedding statistics..."
    
    local total_snippets=$(count_snippets "$DB_FILE" "$LIBRARY_ID")
    local embedded_snippets=$(count_embeddings "$DB_FILE" "$LIBRARY_ID")
    local to_embed=$((total_snippets - embedded_snippets))
    
    if [[ -z "$LIBRARY_ID" ]]; then
        print_success "Total snippets in database: $total_snippets"
        print_success "Already embedded: $embedded_snippets"
        print_success "Need embedding: $to_embed"
    else
        print_success "Library: $LIBRARY_ID"
        print_success "Total snippets: $total_snippets"
        print_success "Already embedded: $embedded_snippets"
        print_success "Need embedding: $to_embed"
    fi
    
    # Provide provider info if no provider selected
    if [[ -z "$PROVIDER" ]]; then
        print_error "No embedding provider specified"
        echo "Use --provider flag, set EMBEDDING_PROVIDER env var, or use --config file"
        exit 1
    fi
    
    # Validate provider settings
    validate_provider_settings "$PROVIDER" "$API_KEY"
    
    # Estimate time
    echo ""
    local estimate=$(estimate_time "$total_snippets" "$PROVIDER")
    print_info "Estimated time to re-embed: $estimate"
    
    # Show confirmation
    echo ""
    echo "Configuration:"
    echo "  Provider: $PROVIDER"
    if [[ -n "$MODEL" ]]; then
        echo "  Model: $MODEL"
    fi
    if [[ -n "$LIBRARY_ID" ]]; then
        echo "  Library: $LIBRARY_ID"
    fi
    echo "  Force: $([ "$FORCE" = true ] && echo "Yes" || echo "No")"
    echo "  Snippets to process: $total_snippets"
    echo ""
    
    read -p "Continue with re-embedding? (y/N): " -r confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_warning "Re-embedding cancelled"
        exit 0
    fi
    
    # Build and execute vectorize command
    echo ""
    print_info "Starting re-embedding process..."
    echo ""
    
    local vectorize_cmd=$(build_vectorize_command)
    
    # Execute command
    local start_time=$(date +%s)
    if eval "$vectorize_cmd"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local hours=$((duration / 3600))
        local minutes=$(((duration % 3600) / 60))
        local seconds=$((duration % 60))
        
        echo ""
        print_success "Re-embedding completed successfully!"
        echo ""
        echo "Statistics:"
        
        # Get new embedding count
        local new_embedded=$(count_embeddings "$DB_FILE" "$LIBRARY_ID")
        echo "  Embeddings created: $((new_embedded - embedded_snippets))"
        echo "  Total embeddings: $new_embedded"
        
        if [[ $hours -gt 0 ]]; then
            echo "  Time taken: ${hours}h ${minutes}m ${seconds}s"
        elif [[ $minutes -gt 0 ]]; then
            echo "  Time taken: ${minutes}m ${seconds}s"
        else
            echo "  Time taken: ${seconds}s"
        fi
        
        echo ""
        print_success "Next steps:"
        echo "  - Run vector search with 'query-docs' using searchMode: 'semantic' or 'hybrid'"
        echo "  - Use 'bun run src/server/index.ts' to start the server"
        echo "  - Check README.md for more examples and use cases"
    else
        print_error "Re-embedding failed"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"
