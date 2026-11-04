// ═══════════════════════════════════════════════════════════════════
// ANIMAL RIVALS — STANDALONE ID SPOOFER
// Load this after frida-il2cpp-bridge.
// ═══════════════════════════════════════════════════════════════════

const FAKE_ID = "133769420"; // Change this to any fake number/name you want

Il2Cpp.perform(() => {
    console.log("[SPOOFER] Started. Forcing ID and Name to: " + FAKE_ID);

    const asmCS = Il2Cpp.domain.assembly("DL.Animals.Core2025").image;
    const NetworkPlayer = asmCS.tryClass("DLARX_NetworkPlayer");
    const PlayFab = asmCS.tryClass("DL.Networking.DLPlayFabManagerClient");
    const PlayersMgr = asmCS.tryClass("DLAR_PlayersManager");

    let spoofInterval = null;

    function applySpoof() {
        if (!NetworkPlayer || !PlayersMgr) return;

        let localPlayer = null;
        try {
            const inst = PlayersMgr.method("get_Instance").invoke();
            localPlayer = inst.field("_myNetworkPlayer").value;
        } catch (_) {}

        if (!localPlayer || localPlayer.isNull()) return;

        // 1. Spoof Oculus ID
        try {
            const fakeIdNum = parseInt(FAKE_ID) || 133769420;
            localPlayer.method("set_OculusId", 1).overload("System.UInt64").invoke(fakeIdNum);
        } catch (_) {}

        // 2. Spoof Display Name
        try {
            localPlayer.method("SetPlayerDisplayName", 1).invoke(Il2Cpp.string(FAKE_ID));
        } catch (_) {}
        
        try {
            localPlayer.field("Player_DisplayName").value = Il2Cpp.string(FAKE_ID);
        } catch (_) {}

        // 3. Spoof PlayFab ID (The ban bypass)
        try {
            const pfInst = PlayFab.method("get_Instance").invoke();
            if (pfInst && !pfInst.isNull()) {
                try { pfInst.method("set_PlayFabId", 1).invoke(Il2Cpp.string(FAKE_ID)); } catch (_) {}
                try { pfInst.field("PlayFabId").value = Il2Cpp.string(FAKE_ID); } catch (_) {}
            }
        } catch (_) {}
    }

    // 4. Auto-inject when the local player spawns
    try {
        const PlayerController = asmCS.tryClass("PlayerController");
        if (PlayerController) {
            const update = PlayerController.tryMethod("LateUpdate", 0);
            if (update && !update.virtualAddress.isNull()) {
                Interceptor.attach(update.virtualAddress, {
                    onEnter(args) {
                        // Only run this once per second to avoid lagging the game
                        const now = Date.now();
                        if (!this.lastSpoof || now - this.lastSpoof > 1000) {
                            this.lastSpoof = now;
                            applySpoof();
                        }
                    }
                });
                console.log("[SPOOFER] Hooked PlayerController.LateUpdate. Spoofing active.");
            }
        }
    } catch (e) {
        console.log("[SPOOFER] Hook error: " + e);
    }
});
