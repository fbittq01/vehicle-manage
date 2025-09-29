#!/bin/bash

# Python AI Server Setup và chạy script
# Sử dụng: ./python_server.sh [command] [options]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BACKEND_URL="ws://localhost:3001"
PYTHON_DIR="python_examples"
VENV_DIR="venv_python_ai"

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} License Plate AI Server Setup ${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  setup     - Setup Python environment và install dependencies"
    echo "  simple    - Chạy simple WebSocket client"
    echo "  advanced  - Chạy advanced AI server"
    echo "  test      - Test kết nối"
    echo "  clean     - Clean up virtual environment"
    echo ""
    echo "Options:"
    echo "  --url <url>        - Backend WebSocket URL (default: ws://localhost:3001)"
    echo "  --duration <sec>   - Simulation duration (default: 60)"
    echo "  --interval <sec>   - Detection interval (default: 5)"
    echo "  --debug           - Enable debug mode"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 simple --duration 120"
    echo "  $0 advanced --debug"
    echo "  $0 test --url ws://localhost:3001"
}

setup_environment() {
    print_header
    echo -e "${YELLOW}Setting up Python environment...${NC}"
    
    # Create virtual environment if not exists
    if [ ! -d "$VENV_DIR" ]; then
        echo -e "${BLUE}Creating virtual environment...${NC}"
        python3 -m venv "$VENV_DIR"
    fi
    
    # Activate virtual environment
    echo -e "${BLUE}Activating virtual environment...${NC}"
    source "$VENV_DIR/bin/activate"
    
    # Upgrade pip
    echo -e "${BLUE}Upgrading pip...${NC}"
    pip install --upgrade pip
    
    # Install requirements
    if [ -f "$PYTHON_DIR/requirements.txt" ]; then
        echo -e "${BLUE}Installing Python dependencies...${NC}"
        pip install -r "$PYTHON_DIR/requirements.txt"
    else
        echo -e "${YELLOW}Installing basic dependencies...${NC}"
        pip install websockets pillow opencv-python numpy requests python-dotenv
    fi
    
    echo -e "${GREEN}✅ Python environment setup completed!${NC}"
    echo -e "${YELLOW}Virtual environment location: $VENV_DIR${NC}"
}

activate_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        echo -e "${RED}❌ Virtual environment not found. Run: $0 setup${NC}"
        exit 1
    fi
    source "$VENV_DIR/bin/activate"
}

run_simple_client() {
    activate_venv
    echo -e "${BLUE}🚀 Starting Simple WebSocket Client...${NC}"
    echo -e "${YELLOW}Connecting to: $BACKEND_URL${NC}"
    
    python "$PYTHON_DIR/simple_client.py" --url "$BACKEND_URL" "$@"
}

run_advanced_server() {
    activate_venv
    echo -e "${BLUE}🚀 Starting Advanced AI Server...${NC}"
    echo -e "${YELLOW}Connecting to: $BACKEND_URL${NC}"
    
    python "$PYTHON_DIR/advanced_ai_server.py" --backend "$BACKEND_URL" "$@"
}

test_connection() {
    activate_venv
    echo -e "${BLUE}🧪 Testing connection...${NC}"
    echo -e "${YELLOW}Backend URL: $BACKEND_URL${NC}"
    
    python "$PYTHON_DIR/simple_client.py" --url "$BACKEND_URL" --mode test
}

clean_environment() {
    echo -e "${YELLOW}Cleaning up Python environment...${NC}"
    if [ -d "$VENV_DIR" ]; then
        rm -rf "$VENV_DIR"
        echo -e "${GREEN}✅ Virtual environment removed${NC}"
    else
        echo -e "${YELLOW}No virtual environment found${NC}"
    fi
}

check_backend_server() {
    echo -e "${BLUE}Checking if backend server is running...${NC}"
    
    # Extract host and port from WebSocket URL
    HOST_PORT=$(echo "$BACKEND_URL" | sed 's|ws://||' | sed 's|/.*||')
    HOST=$(echo "$HOST_PORT" | cut -d: -f1)
    PORT=$(echo "$HOST_PORT" | cut -d: -f2)
    
    if [ "$PORT" = "$HOST" ]; then
        PORT="3001"  # Default port
    fi
    
    # Check if port is open
    if command -v nc >/dev/null 2>&1; then
        if nc -z "$HOST" "$PORT" 2>/dev/null; then
            echo -e "${GREEN}✅ Backend server is running on $HOST:$PORT${NC}"
            return 0
        else
            echo -e "${RED}❌ Backend server is not running on $HOST:$PORT${NC}"
            echo -e "${YELLOW}Please start the Node.js backend server first:${NC}"
            echo -e "${YELLOW}  cd /path/to/backend && npm run dev${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  Cannot check backend server status (nc not available)${NC}"
        return 0
    fi
}

# Parse command line arguments
COMMAND=""
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        setup|simple|advanced|test|clean)
            if [ -z "$COMMAND" ]; then
                COMMAND="$1"
            else
                EXTRA_ARGS+=("$1")
            fi
            shift
            ;;
        --url)
            BACKEND_URL="$2"
            EXTRA_ARGS+=("$1" "$2")
            shift 2
            ;;
        --duration|--interval)
            EXTRA_ARGS+=("$1" "$2")
            shift 2
            ;;
        --debug)
            EXTRA_ARGS+=("$1")
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            EXTRA_ARGS+=("$1")
            shift
            ;;
    esac
done

# Create python_examples directory if not exists
if [ ! -d "$PYTHON_DIR" ]; then
    mkdir -p "$PYTHON_DIR"
fi

# Execute command
case $COMMAND in
    setup)
        setup_environment
        ;;
    simple)
        check_backend_server
        run_simple_client "${EXTRA_ARGS[@]}"
        ;;
    advanced)
        check_backend_server
        run_advanced_server "${EXTRA_ARGS[@]}"
        ;;
    test)
        test_connection
        ;;
    clean)
        clean_environment
        ;;
    *)
        print_usage
        exit 1
        ;;
esac
