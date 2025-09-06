#!/bin/bash

# GLINRDOCK Bundle Size Analyzer
# Analyzes bundle components and suggests optimizations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "${BLUE}[SECTION]${NC} $1"
}

log_detail() {
    echo -e "${CYAN}  →${NC} $1"
}

# Human readable file size
human_size() {
    local size=$1
    if [[ $size -gt 1073741824 ]]; then
        echo "$(( size / 1073741824 ))GB"
    elif [[ $size -gt 1048576 ]]; then
        echo "$(( size / 1048576 ))MB"
    elif [[ $size -gt 1024 ]]; then
        echo "$(( size / 1024 ))KB"
    else
        echo "${size}B"
    fi
}

# Get file size in bytes
file_size() {
    if [[ -f "$1" ]]; then
        if command -v stat &> /dev/null; then
            # Try different stat formats (Linux vs macOS)
            stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0
        else
            ls -la "$1" | awk '{print $5}' || echo 0
        fi
    else
        echo 0
    fi
}

echo -e "${BLUE}"
cat << 'EOF'
  ____  _     ___ _   _ ____  ____   ___   ____ _  __
 / ___|| |   |_ _| \ | |  _ \|  _ \ / _ \ / ___| |/ /
| |  _ | |    | ||  \| | |_) | | | | | | | |   | ' / 
| |_| || |___ | || |\  |  _ <| |_| | |_| | |___| . \ 
 \____|_____|___|_| \_|_| \_\____/ \___/ \____|_|\_\
                                                     
              Bundle Size Analyzer
EOF
echo -e "${NC}"

log_info "Analyzing GLINRDOCK bundle components..."

# Check if we have builds to analyze
if [[ ! -d bin && ! -d dist ]]; then
    log_error "No builds found. Run 'make build' or './scripts/build-bundle.sh' first."
    exit 1
fi

# Total project size
TOTAL_SIZE=0

# 1. Binary Analysis
log_section "Binary Analysis"

if [[ -f bin/glinrdockd ]]; then
    BINARY_SIZE=$(file_size bin/glinrdockd)
    BINARY_SIZE_HUMAN=$(human_size $BINARY_SIZE)
    TOTAL_SIZE=$((TOTAL_SIZE + BINARY_SIZE))
    
    log_detail "Main binary: ${BINARY_SIZE_HUMAN}"
    
    # Check if stripped
    if command -v file &> /dev/null; then
        if file bin/glinrdockd | grep -q 'not stripped'; then
            log_warn "Binary contains debug symbols (use -ldflags='-s -w' to strip)"
        else
            log_info "✅ Binary is stripped"
        fi
    fi
    
    # Check sections (if objdump available)
    if command -v objdump &> /dev/null; then
        echo ""
        log_detail "Binary sections:"
        objdump -h bin/glinrdockd 2>/dev/null | grep -E '\.(text|data|rodata|bss)' | while read line; do
            section=$(echo $line | awk '{print $2}')
            size_hex=$(echo $line | awk '{print $3}')
            if [[ -n "$size_hex" ]]; then
                size_dec=$((16#$size_hex))
                size_human=$(human_size $size_dec)
                printf "${CYAN}    %-10s %s${NC}\n" $section $size_human
            fi
        done
    fi
    
    # Size categories
    if [[ $BINARY_SIZE -gt 83886080 ]]; then  # 80MB
        log_error "Binary is very large (>80MB) - investigate embedded assets"
    elif [[ $BINARY_SIZE -gt 52428800 ]]; then  # 50MB
        log_warn "Binary is large (>50MB) - consider UPX compression"
    else
        log_info "✅ Binary size is reasonable"
    fi
    
else
    log_warn "Main binary not found (bin/glinrdockd)"
fi

# Other binaries
echo ""
for binary in bin/glinrdockd-*; do
    if [[ -f "$binary" ]]; then
        BINARY_SIZE=$(file_size "$binary")
        BINARY_SIZE_HUMAN=$(human_size $BINARY_SIZE)
        TOTAL_SIZE=$((TOTAL_SIZE + BINARY_SIZE))
        log_detail "$(basename "$binary"): ${BINARY_SIZE_HUMAN}"
    fi
done

# 2. Frontend Assets Analysis
echo ""
log_section "Frontend Assets Analysis"

if [[ -d web/ui-lite/dist ]]; then
    FRONTEND_SIZE=0
    
    # JavaScript files
    if compgen -G "web/ui-lite/dist/assets/*.js" > /dev/null; then
        JS_TOTAL=0
        JS_COUNT=0
        for js_file in web/ui-lite/dist/assets/*.js; do
            if [[ -f "$js_file" ]]; then
                SIZE=$(file_size "$js_file")
                JS_TOTAL=$((JS_TOTAL + SIZE))
                JS_COUNT=$((JS_COUNT + 1))
            fi
        done
        FRONTEND_SIZE=$((FRONTEND_SIZE + JS_TOTAL))
        log_detail "JavaScript files: ${JS_COUNT} files, $(human_size $JS_TOTAL)"
    fi
    
    # CSS files
    if compgen -G "web/ui-lite/dist/assets/*.css" > /dev/null; then
        CSS_TOTAL=0
        CSS_COUNT=0
        for css_file in web/ui-lite/dist/assets/*.css; do
            if [[ -f "$css_file" ]]; then
                SIZE=$(file_size "$css_file")
                CSS_TOTAL=$((CSS_TOTAL + SIZE))
                CSS_COUNT=$((CSS_COUNT + 1))
            fi
        done
        FRONTEND_SIZE=$((FRONTEND_SIZE + CSS_TOTAL))
        log_detail "CSS files: ${CSS_COUNT} files, $(human_size $CSS_TOTAL)"
    fi
    
    # Images and other assets
    ASSETS_TOTAL=0
    ASSETS_COUNT=0
    for asset_file in web/ui-lite/dist/assets/*.{png,jpg,jpeg,svg,ico,woff,woff2} web/ui-lite/dist/*.{png,jpg,jpeg,svg,ico}; do
        if [[ -f "$asset_file" ]]; then
            SIZE=$(file_size "$asset_file")
            ASSETS_TOTAL=$((ASSETS_TOTAL + SIZE))
            ASSETS_COUNT=$((ASSETS_COUNT + 1))
        fi
    done
    
    if [[ $ASSETS_COUNT -gt 0 ]]; then
        FRONTEND_SIZE=$((FRONTEND_SIZE + ASSETS_TOTAL))
        log_detail "Static assets: ${ASSETS_COUNT} files, $(human_size $ASSETS_TOTAL)"
    fi
    
    TOTAL_SIZE=$((TOTAL_SIZE + FRONTEND_SIZE))
    log_detail "Total frontend: $(human_size $FRONTEND_SIZE)"
    
    # Frontend optimization suggestions
    if [[ $FRONTEND_SIZE -gt 20971520 ]]; then  # 20MB
        log_warn "Frontend assets are large (>20MB) - consider asset optimization"
    else
        log_info "✅ Frontend size is reasonable"
    fi
    
else
    log_warn "Frontend build not found (web/ui-lite/dist)"
fi

# 3. Source Code Analysis
echo ""
log_section "Source Code Analysis (Development Only)"

# Go source
if [[ -d . ]]; then
    GO_SIZE=$(find . -name "*.go" -not -path "./vendor/*" -not -path "./web/*" -exec stat -f%z {} + 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo 0)
    if [[ $GO_SIZE -gt 0 ]]; then
        log_detail "Go source code: $(human_size $GO_SIZE)"
    fi
fi

# TypeScript/JavaScript source
if [[ -d web/ui-lite/src ]]; then
    TS_SIZE=$(find web/ui-lite/src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -exec stat -f%z {} + 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo 0)
    if [[ $TS_SIZE -gt 0 ]]; then
        log_detail "TypeScript/React source: $(human_size $TS_SIZE)"
    fi
fi

# 4. Package Analysis
echo ""
log_section "Package Analysis"

if [[ -d dist ]]; then
    log_detail "Available packages:"
    for package in dist/*.tar.gz dist/*.zip; do
        if [[ -f "$package" ]]; then
            PKG_SIZE=$(file_size "$package")
            PKG_SIZE_HUMAN=$(human_size $PKG_SIZE)
            log_detail "$(basename "$package"): ${PKG_SIZE_HUMAN}"
            
            # Size recommendations
            if [[ $PKG_SIZE -gt 52428800 ]]; then  # 50MB
                log_warn "Package $(basename "$package") exceeds 50MB target"
            fi
        fi
    done
else
    log_warn "No packages found (dist/ directory)"
fi

# 5. Development Dependencies Analysis
echo ""
log_section "Development Dependencies (Excluded from Bundle)"

# Node modules
if [[ -d web/ui-lite/node_modules ]]; then
    NODE_MODULES_SIZE=$(du -sb web/ui-lite/node_modules 2>/dev/null | cut -f1 || echo 0)
    log_detail "Frontend node_modules: $(human_size $NODE_MODULES_SIZE) (excluded)"
fi

# Go vendor
if [[ -d vendor ]]; then
    VENDOR_SIZE=$(du -sb vendor 2>/dev/null | cut -f1 || echo 0)
    log_detail "Go vendor directory: $(human_size $VENDOR_SIZE) (excluded)"
fi

# Git directory
if [[ -d .git ]]; then
    GIT_SIZE=$(du -sb .git 2>/dev/null | cut -f1 || echo 0)
    log_detail "Git repository: $(human_size $GIT_SIZE) (excluded)"
fi

# 6. Bundle Target Analysis
echo ""
log_section "Bundle Targets vs Actual"

TARGET_BINARY=83886080     # 80MB max binary
TARGET_PACKAGE=52428800    # 50MB max package
TARGET_FRONTEND=20971520   # 20MB max frontend

echo ""
printf "${CYAN}Component${NC}       ${CYAN}Target${NC}     ${CYAN}Actual${NC}     ${CYAN}Status${NC}\n"
printf -- "-------------------------------------------------------\n"

# Binary target
if [[ -f bin/glinrdockd ]]; then
    BINARY_SIZE=$(file_size bin/glinrdockd)
    STATUS="✅ OK"
    if [[ $BINARY_SIZE -gt $TARGET_BINARY ]]; then
        STATUS="❌ OVER"
    elif [[ $BINARY_SIZE -gt $(( TARGET_BINARY * 80 / 100 )) ]]; then
        STATUS="⚠️  HIGH"
    fi
    printf "Binary          80MB       %-10s %s\n" "$(human_size $BINARY_SIZE)" "$STATUS"
fi

# Frontend target
if [[ -d web/ui-lite/dist ]]; then
    FRONTEND_SIZE=$(du -sb web/ui-lite/dist 2>/dev/null | cut -f1 || echo 0)
    STATUS="✅ OK"
    if [[ $FRONTEND_SIZE -gt $TARGET_FRONTEND ]]; then
        STATUS="❌ OVER"
    elif [[ $FRONTEND_SIZE -gt $(( TARGET_FRONTEND * 80 / 100 )) ]]; then
        STATUS="⚠️  HIGH"
    fi
    printf "Frontend        20MB       %-10s %s\n" "$(human_size $FRONTEND_SIZE)" "$STATUS"
fi

# Package target
if [[ -f dist/glinrdock-*.tar.gz ]]; then
    LATEST_PACKAGE=$(ls -t dist/glinrdock-*.tar.gz | head -1)
    PACKAGE_SIZE=$(file_size "$LATEST_PACKAGE")
    STATUS="✅ OK"
    if [[ $PACKAGE_SIZE -gt $TARGET_PACKAGE ]]; then
        STATUS="❌ OVER"
    elif [[ $PACKAGE_SIZE -gt $(( TARGET_PACKAGE * 80 / 100 )) ]]; then
        STATUS="⚠️  HIGH"
    fi
    printf "Package         50MB       %-10s %s\n" "$(human_size $PACKAGE_SIZE)" "$STATUS"
fi

# 7. Optimization Recommendations
echo ""
log_section "Optimization Recommendations"

RECOMMENDATIONS=()

# Binary optimizations
if [[ -f bin/glinrdockd ]]; then
    BINARY_SIZE=$(file_size bin/glinrdockd)
    
    if file bin/glinrdockd | grep -q 'not stripped'; then
        RECOMMENDATIONS+=("Strip debug symbols: go build -ldflags='-s -w'")
    fi
    
    if [[ $BINARY_SIZE -gt 52428800 ]]; then  # 50MB
        RECOMMENDATIONS+=("Consider UPX compression for smaller binaries")
        RECOMMENDATIONS+=("Review embedded assets - may be too large")
    fi
    
    if ! command -v upx &> /dev/null && [[ $BINARY_SIZE -gt 31457280 ]]; then  # 30MB
        RECOMMENDATIONS+=("Install UPX for binary compression: apt install upx-ucl")
    fi
fi

# Frontend optimizations
if [[ -d web/ui-lite ]]; then
    if [[ ! -f web/ui-lite/.env.production ]]; then
        RECOMMENDATIONS+=("Create .env.production for optimized frontend builds")
    fi
    
    # Check for large assets
    if [[ -d web/ui-lite/dist ]]; then
        LARGE_ASSETS=$(find web/ui-lite/dist -size +1M -type f 2>/dev/null | head -3)
        if [[ -n "$LARGE_ASSETS" ]]; then
            RECOMMENDATIONS+=("Optimize large assets found in frontend build")
        fi
    fi
fi

# Dependency optimizations
if [[ -f go.mod ]]; then
    UNUSED_DEPS=$(go mod tidy -v 2>&1 | grep -c "removed" || echo 0)
    if [[ $UNUSED_DEPS -gt 0 ]]; then
        RECOMMENDATIONS+=("Run 'go mod tidy' to remove unused dependencies")
    fi
fi

# Display recommendations
if [[ ${#RECOMMENDATIONS[@]} -gt 0 ]]; then
    for rec in "${RECOMMENDATIONS[@]}"; do
        log_warn "$rec"
    done
else
    log_info "✅ No major optimizations needed - bundle is well optimized"
fi

# 8. Next Steps
echo ""
log_section "Next Steps"

if [[ ${#RECOMMENDATIONS[@]} -gt 0 ]]; then
    log_detail "1. Apply optimization recommendations above"
    log_detail "2. Rebuild with: ./scripts/build-bundle.sh"
    log_detail "3. Test optimized bundle on target systems"
else
    log_detail "1. Bundle is ready for distribution testing"
    log_detail "2. Test installation on clean systems"
    log_detail "3. Upload to package repositories"
fi

log_detail "4. Monitor bundle performance in production"

echo ""
log_info "Bundle analysis completed! 🎯"