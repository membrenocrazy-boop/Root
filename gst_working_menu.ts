"use strict";

Il2Cpp.perform(() => {
    console.log("[GST] Safe boot...");

    const S = {
        godmode: false,
        fly: false,
        killAll: false
    };

    let localPlayer = null;
    let playerClass = null;
    let monsterClasses = [];
    let isReady = false;

    try {
        const asm = Il2Cpp.domain.assembly("Assembly-CSharp").image;
        playerClass = asm.tryClass("PhotonVRPlayer");
        
        const e1 = asm.tryClass("EnemyController");
        const e2 = asm.tryClass("ShriglesMonsterAI");
        if (e1) monsterClasses.push(e1);
        if (e2) monsterClasses.push(e2);

        console.log("[GST] Classes found.");
    } catch (e) {
        console.log("[GST] Class error: " + e);
    }

    if (playerClass) {
        const update = playerClass.tryMethod("Update", 0) || playerClass.tryMethod("LateUpdate", 0);
        if (update && !update.virtualAddress.isNull()) {
            Interceptor.attach(update.virtualAddress, {
                onEnter(args) {
                    if (this.method("get_IsMine", 0).invoke() === true) {
                        localPlayer = this;
                        isReady = true;
                    }
                    
                    if (localPlayer && this.handle.equals(localPlayer.handle)) {
                        if (S.godmode) {
                            try { this.field("currentHealth").value = 99999; } catch(e) {}
                        }
                    }
                }
            });
            console.log("[GST] Player hooked.");
        }
    }

    function doKillAll() {
        const getUnity = (name) => Il2Cpp.domain.assembly("UnityEngine.CoreModule").image.class(name);
        const Object = getUnity("UnityEngine.Object");
        
        for (const mClass of monsterClasses) {
            const arr = Object.method("FindObjectsOfType", 1).inflate(mClass).invoke();
            for (let i = 0; i < arr.length; i++) {
                try { arr.get(i).method("TakeDamage", 1).invoke(99999); } catch(e) {}
            }
        }
    }

    setInterval(() => {
        if (!isReady) return;
        if (S.killAll) {
            S.killAll = false;
            doKillAll();
            console.log("[GST] Kill All fired.");
        }
    }, 100);

    // Commands for testing without the menu
    globalThis.GST = {
        god: () => { S.godmode = !S.godmode; return "God: " + S.godmode; },
        kill: () => { S.killAll = true; return "Killing..."; }
    };

    console.log("[GST] Safe menu loaded. Type GST.god() or GST.kill() in console.");
});
