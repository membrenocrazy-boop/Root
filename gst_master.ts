"use strict";

Il2Cpp.perform(() => {
    console.log("[GST MASTER] Booting up and blocking kicks...");

    // ── 1. ANTI-KICK BYPASS ──────────────────────────────────────────────
    const asm = Il2Cpp.domain.assembly("Assembly-CSharp").image;
    const kickNames = ["kickplayer", "kick", "KickHammer", "GSTRemoteMotionGuard"];
    
    for (const kName of kickNames) {
        try {
            const cls = asm.tryClass(kName);
            if (cls) {
                for (const m of cls.methods) {
                    if (m.name.toLowerCase().includes("kick") || m.name.toLowerCase().includes("punish") || m.name.toLowerCase().includes("guard")) {
                        // Hook the kick method and return immediately (do nothing)
                        if (m.parameterCount === 0) {
                            m.implementation = function() { return; };
                        } else {
                            // Skip it entirely
                            m.implementation = function() { return; };
                        }
                        console.log("[GST MASTER] Blocked " + kName + "." + m.name);
                    }
                }
            }
        } catch(e) {}
    }

    // ── 2. STATE & CLASSES ───────────────────────────────────────────────
    const S = {
        godmode: false, fly: false, flySpeed: 10, noclip: false, platforms: false,
        killAll: false, tpAll: false, flingGun: false, lagGun: false, killGun: false
    };

    let localPlayer = null;
    const playerClass = asm.tryClass("PhotonVRPlayer");
    const e1 = asm.tryClass("EnemyController");
    const e2 = asm.tryClass("ShriglesMonsterAI");
    const monsterClasses = [];
    if (e1) monsterClasses.push(e1);
    if (e2) monsterClasses.push(e2);

    const Core = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image;
    const PhysicsMod = Il2Cpp.domain.assembly("UnityEngine.PhysicsModule").image;
    const GameObject = Core.class("UnityEngine.GameObject");
    const Object = Core.class("UnityEngine.Object");
    const Rigidbody = PhysicsMod.class("UnityEngine.Rigidbody");
    const Renderer = Core.class("UnityEngine.Renderer");
    const Shader = Core.class("UnityEngine.Shader");
    const Quaternion = Core.class("UnityEngine.Quaternion");

    // ── 3. PLAYER HOOKS (God, Fly, Platforms) ────────────────────────────
    if (playerClass) {
        const update = playerClass.tryMethod("Update", 0) || playerClass.tryMethod("LateUpdate", 0);
        if (update) {
            Interceptor.attach(update.virtualAddress, {
                onEnter(args) {
                    if (this.method("get_IsMine", 0).invoke() === true) localPlayer = this;
                    
                    if (localPlayer && this.handle.equals(localPlayer.handle)) {
                        if (S.godmode) {
                            try { this.field("currentHealth").value = 99999; } catch(e) {}
                            try { this.field("health").value = 99999; } catch(e) {}
                        }
                        
                        try {
                            const rb = this.method("GetComponent", 1).inflate(Rigidbody).invoke();
                            if (rb) {
                                if (S.fly || S.noclip) {
                                    rb.method("set_useGravity", 1).invoke(false);
                                    if (S.noclip) rb.method("set_detectCollisions", 1).invoke(false);
                                    
                                    if (S.fly) {
                                        const fwd = this.method("get_transform").invoke().method("get_forward").invoke();
                                        rb.method("set_velocity", 1).invoke({ x: fwd.field("x").value * S.flySpeed, y: fwd.field("y").value * S.flySpeed, z: fwd.field("z").value * S.flySpeed });
                                    }
                                } else {
                                    rb.method("set_useGravity", 1).invoke(true);
                                    rb.method("set_detectCollisions", 1).invoke(true);
                                }
                            }
                        } catch(e) {}
                    }
                }
            });
        }
    }

    // ── 4. ACTIONS ───────────────────────────────────────────────────────
    function doKillAll() {
        for (const mClass of monsterClasses) {
            const arr = Object.method("FindObjectsOfType", 1).inflate(mClass).invoke();
            for (let i = 0; i < arr.length; i++) {
                try { arr.get(i).method("TakeDamage", 1).invoke(99999); } catch(e) {}
                try { arr.get(i).method("Die", 0).invoke(); } catch(e) {}
            }
        }
    }

    function doTpAll() {
        if (!localPlayer) return;
        try {
            const myPos = localPlayer.method("get_transform").invoke().method("get_position").invoke();
            const arr = Object.method("FindObjectsOfType", 1).inflate(playerClass).invoke();
            for (let i = 0; i < arr.length; i++) {
                const p = arr.get(i);
                if (p && p.method("get_IsMine", 0).invoke() === false) {
                    try { p.method("get_transform").invoke().method("set_position", 1).invoke(myPos); } catch(e) {}
                }
            }
        } catch(e) {}
    }

    // ── 5. UI BUILDING (Canvas + Raycast) ─────────────────────────────────
    let menu = null;
    let pointerLine = null;
    let rightTrigger = false, prevTrigger = false;
    let buttonsList = [];

    const UIModule = Il2Cpp.domain.assembly("UnityEngine.UIModule").image;
    const Canvas = UIModule.class("UnityEngine.Canvas");
    const Text = Il2Cpp.domain.assembly("UnityEngine.UI").image.class("UnityEngine.UI.Text");
    const Font = Il2Cpp.domain.assembly("UnityEngine.TextRenderingModule").image.class("UnityEngine.Font");
    const BoxCollider = PhysicsMod.class("UnityEngine.BoxCollider");
    const Physics = PhysicsMod.class("UnityEngine.Physics");

    function createButton(parent, text, y, onClick) {
        const btnGo = GameObject.method("CreatePrimitive", 1).invoke(3);
        btnGo.method("set_name", 1).invoke(Il2Cpp.string("Btn_" + text));
        const tr = btnGo.method("get_transform").invoke();
        tr.method("SetParent", 2).invoke(parent, false);
        tr.method("set_localScale", 1).invoke({ x: 0.9, y: 0.1, z: 0.05 });
        tr.method("set_localPosition", 1).invoke({ x: 0, y: y, z: 0 });

        const rend = btnGo.method("GetComponent", 1).inflate(Renderer).invoke();
        if (rend) {
            const mat = rend.method("get_material").invoke();
            mat.method("set_shader", 1).invoke(Shader.method("Find", 1).invoke(Il2Cpp.string("Sprites/Default")));
            mat.method("set_color", 1).invoke({ r: 0.1, g: 0.1, b: 0.15, a: 1 });
        }
        
        let col = btnGo.method("GetComponent", 1).inflate(BoxCollider).invoke();
        if (!col || col.handle.isNull()) {
            btnGo.method("AddComponent", 1).invoke(BoxCollider.type.object);
        }
        
        buttonsList.push({ go: btnGo, action: onClick, name: text });
    }

    menu = GameObject.method("CreatePrimitive", 1).invoke(3);
    menu.method("set_name", 1).invoke(Il2Cpp.string("GST_Menu"));
    const mTr = menu.method("get_transform").invoke();
    mTr.method("set_localScale", 1).invoke({ x: 0.7, y: 0.9, z: 0.02 });
    
    createButton(mTr, "Godmode", 0.35, () => { S.godmode = !S.godmode; });
    createButton(mTr, "Fly", 0.20, () => { S.fly = !S.fly; });
    createButton(mTr, "Noclip", 0.05, () => { S.noclip = !S.noclip; });
    createButton(mTr, "Kill All", -0.10, () => { doKillAll(); });
    createButton(mTr, "TP All", -0.25, () => { doTpAll(); });

    // Pointer
    pointerLine = GameObject.method("CreatePrimitive", 1).invoke(3);
    const lr = pointerLine.method("AddComponent", 1).invoke(Core.class("UnityEngine.LineRenderer").type.object);
    if (lr) {
        lr.method("set_positionCount", 1).invoke(2);
        lr.method("set_startWidth", 1).invoke(0.01);
        lr.method("set_endWidth", 1).invoke(0.01);
    }

    // ── 6. TICK LOOP ─────────────────────────────────────────────────────
    setInterval(() => {
        if (!localPlayer || !menu) return;
        
        // Move Menu
        try {
            const head = localPlayer.method("get_transform").invoke();
            const fwd = head.method("get_forward").invoke();
            const pos = head.method("get_position").invoke();
            const nx = pos.field("x").value + fwd.field("x").value * 0.8;
            const ny = pos.field("y").value + fwd.field("y").value * 0.8;
            const nz = pos.field("z").value + fwd.field("z").value * 0.8;
            
            menu.method("get_transform").invoke().method("set_position", 1).invoke({ x: nx, y: ny, z: nz });
            const rot = Quaternion.method("LookRotation", 1).invoke({ x: nx - pos.field("x").value, y: ny - pos.field("y").value, z: nz - pos.field("z").value });
            menu.method("get_transform").invoke().method("set_rotation", 1).invoke(rot);
        } catch(e) {}

        // Raycast / Click
        try {
            const head = localPlayer.method("get_transform").invoke();
            const startPos = head.method("get_position").invoke();
            const fwd = head.method("get_forward").invoke();
            const hitBuffer = Il2Cpp.alloc(128);
            const hitRef = Il2Cpp.reference(hitBuffer);
            
            const hit = Physics.method("Raycast", 6).overload("UnityEngine.Vector3", "UnityEngine.Vector3", "UnityEngine.RaycastHit&", "System.Single", "System.Int32", "System.Int32")
                .invoke(startPos, fwd, hitRef, 2.0, -1, 2);
                
            let endPos = { x: startPos.field("x").value + fwd.field("x").value * 2, y: startPos.field("y").value + fwd.field("y").value * 2, z: startPos.field("z").value + fwd.field("z").value * 2 };
            
            if (hit) {
                endPos = hitRef.method("get_point", 0).invoke();
                const hitObj = hitRef.method("get_collider", 0).invoke().method("get_gameObject", 0).invoke();
                for (const btn of buttonsList) {
                    if (btn.go.handle.equals(hitObj.handle) && rightTrigger && !prevTrigger) {
                        btn.action();
                    }
                }
            }
            
            if (lr) {
                lr.method("SetPosition", 2).invoke(0, startPos);
                lr.method("SetPosition", 2).invoke(1, endPos);
            }
        } catch(e) {}

        // Read OVR Trigger
        try {
            const OVR = asm.tryClass("OVRInput");
            if (OVR) {
                const trig = OVR.method("Get", 2).invoke(1, 2);
                rightTrigger = Number(trig) > 0.5;
            }
        } catch(e) {}

        prevTrigger = rightTrigger;
    }, 50);

    console.log("[GST MASTER] Ready. Menu and Raycast Active.");
});
