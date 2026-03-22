#!/bin/bash
# ============================================================================
# SAI ROLOTECH SMART ENGINES — One-Click Setup Script
# Precision Roll Forming Engineering Suite (Ultra Pro Max)
# ============================================================================
# Usage:  chmod +x setup.sh && ./setup.sh
# ============================================================================

set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS="${GREEN}✔${NC}"
FAIL="${RED}✘${NC}"
WARN="${YELLOW}⚠${NC}"
INFO="${CYAN}ℹ${NC}"

TOTAL_STEPS=0
PASSED_STEPS=0
FAILED_STEPS=0

log_pass() { echo -e "  ${PASS} $1"; ((PASSED_STEPS++)); ((TOTAL_STEPS++)); }
log_fail() { echo -e "  ${FAIL} $1"; ((FAILED_STEPS++)); ((TOTAL_STEPS++)); }
log_warn() { echo -e "  ${WARN} $1"; ((TOTAL_STEPS++)); }
log_info() { echo -e "  ${INFO} $1"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       SAI ROLOTECH SMART ENGINES — SYSTEM SETUP            ║${NC}"
echo -e "${BOLD}║       Precision Roll Forming Engineering Suite              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── STEP 1: System Detection ───
echo -e "${BOLD}[1/8] System Detection${NC}"
OS=$(uname -s)
ARCH=$(uname -m)
HOSTNAME=$(hostname)
KERNEL=$(uname -r)
log_info "OS: ${OS} | Arch: ${ARCH} | Host: ${HOSTNAME}"
log_info "Kernel: ${KERNEL}"

if [[ "$OS" == "Linux" ]]; then
    log_pass "Linux detected — full hardware support"
elif [[ "$OS" == "Darwin" ]]; then
    log_pass "macOS detected — Metal GPU + hardware support"
else
    log_warn "Windows/Other — some features may need WSL"
fi

# ─── STEP 2: CPU / Hardware Detection ───
echo ""
echo -e "${BOLD}[2/8] CPU & Hardware Detection${NC}"

CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
CPU_MODEL=$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))

if [[ "$TOTAL_RAM_GB" -eq 0 ]]; then
    if [[ "$OS" == "Darwin" ]]; then
        TOTAL_RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
        TOTAL_RAM_GB=$((TOTAL_RAM_BYTES / 1024 / 1024 / 1024))
    fi
fi

log_info "CPU: ${CPU_MODEL}"
log_info "CPU Cores: ${CPU_CORES}"
log_info "Total RAM: ${TOTAL_RAM_GB} GB"

WORKER_POOL_SIZE=$((CPU_CORES - 1))
if [[ "$WORKER_POOL_SIZE" -lt 2 ]]; then WORKER_POOL_SIZE=2; fi
if [[ "$WORKER_POOL_SIZE" -gt 8 ]]; then WORKER_POOL_SIZE=8; fi
log_pass "Worker Pool Size: ${WORKER_POOL_SIZE} threads (optimized for ${CPU_CORES} cores)"

if [[ "$CPU_CORES" -ge 8 ]]; then
    log_pass "CPU: HIGH-PERFORMANCE (${CPU_CORES} cores) — full parallel FEA, batch G-code"
elif [[ "$CPU_CORES" -ge 4 ]]; then
    log_pass "CPU: STANDARD (${CPU_CORES} cores) — parallel computation enabled"
else
    log_warn "CPU: LOW (${CPU_CORES} cores) — limited parallelism, consider upgrade"
fi

if [[ "$TOTAL_RAM_GB" -ge 16 ]]; then
    log_pass "RAM: EXCELLENT (${TOTAL_RAM_GB} GB) — full mesh caching, large assemblies"
elif [[ "$TOTAL_RAM_GB" -ge 8 ]]; then
    log_pass "RAM: GOOD (${TOTAL_RAM_GB} GB) — standard workloads"
elif [[ "$TOTAL_RAM_GB" -ge 4 ]]; then
    log_warn "RAM: LIMITED (${TOTAL_RAM_GB} GB) — reduce mesh density for large profiles"
else
    log_fail "RAM: INSUFFICIENT (${TOTAL_RAM_GB} GB) — minimum 4 GB recommended"
fi

# ─── STEP 3: GPU Detection ───
echo ""
echo -e "${BOLD}[3/8] GPU Detection${NC}"

GPU_NAME="Not detected"
GPU_TIER="unknown"

if command -v lspci &>/dev/null; then
    GPU_LINE=$(lspci 2>/dev/null | grep -i 'vga\|3d\|display' | head -1 | cut -d: -f3- | xargs)
    if [[ -n "$GPU_LINE" ]]; then
        GPU_NAME="$GPU_LINE"
    fi
elif [[ "$OS" == "Darwin" ]]; then
    GPU_NAME=$(system_profiler SPDisplaysDataType 2>/dev/null | grep "Chipset Model" | cut -d: -f2 | xargs || echo "Apple GPU")
fi

GPU_LOWER=$(echo "$GPU_NAME" | tr '[:upper:]' '[:lower:]')

if echo "$GPU_LOWER" | grep -qE "rtx 40|rtx 50|rx 7900|apple m3|apple m4|a100|h100"; then
    GPU_TIER="ULTRA"
    log_pass "GPU: ${GPU_NAME} — ULTRA tier (max particles, SSAO, bloom, post-processing)"
elif echo "$GPU_LOWER" | grep -qE "rtx|rx 6|rx 7|radeon pro|quadro|gtx 1080|gtx 1070|apple m1|apple m2"; then
    GPU_TIER="HIGH"
    log_pass "GPU: ${GPU_NAME} — HIGH tier (full 3D, shadows, reflections)"
elif echo "$GPU_LOWER" | grep -qE "swiftshader|llvmpipe|mesa|microsoft basic|virtualbox|vmware"; then
    GPU_TIER="LOW"
    log_warn "GPU: ${GPU_NAME} — LOW tier (software rendering, reduced quality)"
else
    GPU_TIER="MEDIUM"
    log_pass "GPU: ${GPU_NAME} — MEDIUM tier (standard 3D rendering)"
fi

if command -v glxinfo &>/dev/null; then
    GL_VERSION=$(glxinfo 2>/dev/null | grep "OpenGL version" | head -1 | cut -d: -f2 | xargs || echo "Unknown")
    log_info "OpenGL: ${GL_VERSION}"
fi

# ─── STEP 4: Node.js & pnpm Check ───
echo ""
echo -e "${BOLD}[4/8] Runtime Environment${NC}"

if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v)
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
    if [[ "$NODE_MAJOR" -ge 18 ]]; then
        log_pass "Node.js: ${NODE_VERSION} (minimum v18 required)"
    else
        log_fail "Node.js: ${NODE_VERSION} — upgrade to v18+ required"
    fi
else
    log_fail "Node.js: NOT INSTALLED — install Node.js v18+"
fi

if command -v pnpm &>/dev/null; then
    PNPM_VERSION=$(pnpm -v)
    log_pass "pnpm: v${PNPM_VERSION}"
else
    log_warn "pnpm not found — installing..."
    npm install -g pnpm 2>/dev/null && log_pass "pnpm installed" || log_fail "pnpm install failed"
fi

if command -v tsx &>/dev/null || npx tsx --version &>/dev/null 2>&1; then
    log_pass "tsx runtime available (TypeScript execution)"
else
    log_warn "tsx not found — will use fallback"
fi

# ─── STEP 5: Install Dependencies ───
echo ""
echo -e "${BOLD}[5/8] Installing Dependencies${NC}"

if [[ -f "pnpm-workspace.yaml" ]]; then
    log_info "Monorepo workspace detected"
    log_info "Installing all workspace packages..."
    if pnpm install --frozen-lockfile 2>/dev/null || pnpm install 2>/dev/null; then
        log_pass "All packages installed successfully"
    else
        log_fail "Package installation failed — check network connection"
    fi
else
    log_fail "pnpm-workspace.yaml not found — run from project root"
fi

FRONTEND_DEPS=("react" "react-dom" "three" "zustand" "firebase" "jszip" "jspdf")
BACKEND_DEPS=("express" "drizzle-orm" "systeminformation" "jose")

echo ""
log_info "Verifying critical frontend packages..."
for dep in "${FRONTEND_DEPS[@]}"; do
    if [[ -d "node_modules/$dep" ]] || pnpm list "$dep" --depth 0 &>/dev/null 2>&1; then
        log_pass "${dep}"
    else
        log_fail "${dep} — MISSING"
    fi
done

echo ""
log_info "Verifying critical backend packages..."
for dep in "${BACKEND_DEPS[@]}"; do
    if [[ -d "node_modules/$dep" ]] || pnpm list "$dep" --depth 0 &>/dev/null 2>&1; then
        log_pass "${dep}"
    else
        log_fail "${dep} — MISSING"
    fi
done

# ─── STEP 6: DWG Converter Check ───
echo ""
echo -e "${BOLD}[6/8] CAD Tools & System Libraries${NC}"

if command -v dwg2dxf &>/dev/null; then
    log_pass "DWG-to-DXF converter (LibreDWG) available"
else
    log_warn "dwg2dxf not found — DWG import disabled, DXF import still works"
fi

if command -v openssl &>/dev/null; then
    OPENSSL_VER=$(openssl version 2>/dev/null || echo "Unknown")
    log_pass "OpenSSL: ${OPENSSL_VER}"
else
    log_warn "OpenSSL not found — HTTPS/TLS may have issues"
fi

if [[ -d "/tmp" ]] && [[ -w "/tmp" ]]; then
    log_pass "Temp directory writable (/tmp) — file processing OK"
else
    log_warn "Temp directory not writable — file uploads may fail"
fi

UPLOADS_DIR="artifacts/api-server/uploads"
if [[ ! -d "$UPLOADS_DIR" ]]; then
    mkdir -p "$UPLOADS_DIR" 2>/dev/null && log_pass "Created uploads directory" || log_warn "Could not create uploads dir"
else
    log_pass "Uploads directory exists"
fi

# ─── STEP 7: Environment Variables Check ───
echo ""
echo -e "${BOLD}[7/8] Environment Configuration${NC}"

check_env() {
    if [[ -n "${!1}" ]]; then
        log_pass "$1 is set"
        return 0
    else
        log_warn "$1 not set — $2"
        return 1
    fi
}

check_env "VITE_FIREBASE_API_KEY" "Firebase auth will not work" || true
check_env "VITE_FIREBASE_AUTH_DOMAIN" "Firebase auth domain needed" || true
check_env "VITE_FIREBASE_PROJECT_ID" "Firebase project ID needed" || true
check_env "DATABASE_URL" "Database connection required" || true

if [[ -n "$PORT" ]]; then
    log_info "PORT: ${PORT}"
fi

# ─── STEP 8: Build & Verify ───
echo ""
echo -e "${BOLD}[8/8] Build Verification${NC}"

if [[ -f "artifacts/design-tool/vite.config.ts" ]]; then
    log_pass "Frontend config (vite.config.ts) found"
fi

if [[ -f "artifacts/api-server/src/index.ts" ]]; then
    log_pass "Backend entry point (index.ts) found"
fi

if [[ -f "artifacts/design-tool/src/lib/hardware-engine.ts" ]]; then
    log_pass "Hardware acceleration engine present"
fi

if [[ -f "artifacts/design-tool/src/lib/gpu-tier.ts" ]]; then
    log_pass "GPU tier detection system present"
fi

if [[ -f "artifacts/design-tool/src/hooks/useWebLLM.ts" ]]; then
    log_pass "Offline AI engine (WebLLM + CPU fallback) present"
fi

if [[ -f "artifacts/api-server/src/lib/workers/worker-pool.ts" ]]; then
    log_pass "Backend worker pool present"
fi

# ─── SUMMARY ───
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                     SETUP SUMMARY                          ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║${NC}  CPU: ${CPU_MODEL}"
echo -e "${BOLD}║${NC}  Cores: ${CPU_CORES} | Worker Pool: ${WORKER_POOL_SIZE} threads"
echo -e "${BOLD}║${NC}  RAM: ${TOTAL_RAM_GB} GB"
echo -e "${BOLD}║${NC}  GPU: ${GPU_NAME} (${GPU_TIER})"
echo -e "${BOLD}║${NC}  "
echo -e "${BOLD}║${NC}  ${GREEN}Passed: ${PASSED_STEPS}${NC}  |  ${RED}Failed: ${FAILED_STEPS}${NC}  |  Total: ${TOTAL_STEPS}"
echo -e "${BOLD}║${NC}  "

if [[ "$FAILED_STEPS" -eq 0 ]]; then
    echo -e "${BOLD}║${NC}  ${GREEN}${BOLD}STATUS: ALL SYSTEMS READY ✔${NC}"
    echo -e "${BOLD}║${NC}  "
    echo -e "${BOLD}║${NC}  Hardware Mode: ENABLED"
    echo -e "${BOLD}║${NC}  Cloud Dependency: MINIMAL (offline-first)"
    echo -e "${BOLD}║${NC}  "
    echo -e "${BOLD}║${NC}  Start the application:"
    echo -e "${BOLD}║${NC}    pnpm --filter @workspace/api-server run dev &"
    echo -e "${BOLD}║${NC}    pnpm --filter @workspace/design-tool run dev"
elif [[ "$FAILED_STEPS" -le 2 ]]; then
    echo -e "${BOLD}║${NC}  ${YELLOW}${BOLD}STATUS: MOSTLY READY (${FAILED_STEPS} issues)${NC}"
    echo -e "${BOLD}║${NC}  Fix the failed items above, then re-run setup.sh"
else
    echo -e "${BOLD}║${NC}  ${RED}${BOLD}STATUS: SETUP INCOMPLETE (${FAILED_STEPS} issues)${NC}"
    echo -e "${BOLD}║${NC}  Fix the failed items above, then re-run setup.sh"
fi

echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Write hardware config for the app to read
CONFIG_FILE="hardware-config.json"
cat > "$CONFIG_FILE" <<EOF
{
  "setupDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "system": {
    "os": "${OS}",
    "arch": "${ARCH}",
    "hostname": "${HOSTNAME}",
    "kernel": "${KERNEL}"
  },
  "cpu": {
    "model": "${CPU_MODEL}",
    "cores": ${CPU_CORES},
    "workerPoolSize": ${WORKER_POOL_SIZE},
    "performanceTier": "$([ "$CPU_CORES" -ge 8 ] && echo 'high' || ([ "$CPU_CORES" -ge 4 ] && echo 'medium' || echo 'low'))"
  },
  "gpu": {
    "name": "${GPU_NAME}",
    "tier": "$(echo "$GPU_TIER" | tr '[:upper:]' '[:lower:]')"
  },
  "memory": {
    "totalGB": ${TOTAL_RAM_GB}
  },
  "setup": {
    "totalChecks": ${TOTAL_STEPS},
    "passed": ${PASSED_STEPS},
    "failed": ${FAILED_STEPS},
    "status": "$([ "$FAILED_STEPS" -eq 0 ] && echo 'ready' || echo 'incomplete')"
  },
  "features": {
    "hardwareAcceleration": true,
    "offlineAI": true,
    "webWorkerPool": true,
    "gpuRendering": $([ "$GPU_TIER" != "LOW" ] && echo true || echo false),
    "cloudDependency": "minimal"
  }
}
EOF

log_info "Hardware config saved to ${CONFIG_FILE}"
echo ""
