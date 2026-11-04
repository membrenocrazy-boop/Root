"use strict";

let menu = null;
let pointerLine = null;
let buttonsList: any[] = [];
let buttonClickDelay = 0.0;

let rightTrigger = false;
let prevTrigger = false;

let hue = 0;
let bgColor: [number, number, number, number] = [0.02, 0.02, 0.035, 0.97];
let textColor: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0];
let buttonColor: [number, number, number, number] = [0.035, 0.035, 0.05, 1.0];
let buttonPressedColor: [number, number, number, number] = [0.1, 0.35, 1.0, 1.0];

let menuName = "GST | mestro";
const MENU_VERSION = "1.1.0";

const S = {
    godmode: false,
    fly: false,
    flySpeed: 10,
    noclip: false,
    killAll: false,
    tpAll: false
};

let localPlayer = null;
let playerClass = null;
let knownMonsters: any[] = [];

function logV(...args: any[]) {
  console.log("[GST-MENU]", ...args);
}

Il2Cpp.perform(() => {
  const AssemblyCSharp = Il2Cpp.domain.assembly("Assembly-CSharp").image;
  const UnityEngineCore = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image;
  const UnityEnginePhysics = Il2Cpp.domain.assembly("UnityEngine.PhysicsModule").image;
  const UnityEngineUIModule = Il2Cpp.domain.assembly("UnityEngine.UIModule").image;
  const UnityEngineUI = Il2Cpp.domain.assembly("UnityEngine.UI").image;
  const UnityEngineTextRendering = Il2Cpp.domain.assembly("UnityEngine.TextRenderingModule").image;

  const GameObject = UnityEngineCore.class("UnityEngine.GameObject");
  const Object = UnityEngineCore.class("UnityEngine.Object");
  const Vector3 = UnityEngineCore.class("UnityEngine.Vector3");
  const Quaternion = UnityEngineCore.class("UnityEngine.Quaternion");
  const Camera = UnityEngineCore.class("UnityEngine.Camera");
  const Renderer = UnityEngineCore.class("UnityEngine.Renderer");
  const Shader = UnityEngineCore.class("UnityEngine.Shader");
  const BoxCollider = UnityEnginePhysics.class("UnityEngine.BoxCollider");
  const Rigidbody = UnityEnginePhysics.class("UnityEngine.Rigidbody");
  const Physics = UnityEnginePhysics.class("UnityEngine.Physics");
  const LineRenderer = UnityEngineCore.class("UnityEngine.LineRenderer");

  // Find GST Classes
  playerClass = AssemblyCSharp.tryClass("PhotonVRPlayer");
  const e1 = AssemblyCSharp.tryClass("EnemyController");
  const e2 = AssemblyCSharp.tryClass("ShriglesMonsterAI");
  if (e1) knownMonsters.push(e1);
  if (e2) knownMonsters.push(e2);

  // --- HOOKS ---
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

  // --- ACTIONS ---
  function doKillAll() {
    for (const mClass of knownMonsters) {
      const arr = Object.method("FindObjectsOfType", 1).inflate(mClass).invoke();
      for (let i = 0; i < arr.length; i++) {
        try { arr.get(i).method("TakeDamage", 1).invoke(99999); } catch(e) {}
        try { arr.get(i).method("Die", 0).invoke(); } catch(e) {}
      }
    }
    logV("Kill All fired.");
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
      logV("TP All fired.");
    } catch(e) {}
  }

  // --- UI DRAWING ---
  function createButton(parent: any, text: string, y: number, onClick: any) {
    const btnGo = GameObject.method("CreatePrimitive", 1).invoke(3);
    btnGo.method("set_name", 1).invoke(Il2Cpp.string("Btn_" + text));
    const tr = btnGo.method("get_transform").invoke();
    tr.method("SetParent", 2).invoke(parent, false);
    tr.method("set_localScale", 1).invoke({ x: 0.9, y: 0.12, z: 0.05 });
    tr.method("set_localPosition", 1).invoke({ x: 0, y: y, z: 0 });
    
    // Make it look like a button
    const rend = btnGo.method("GetComponent", 1).inflate(Renderer).invoke();
    if (rend) {
      const mat = rend.method("get_material").invoke();
      mat.method("set_shader", 1).invoke(Shader.method("Find", 1).invoke(Il2Cpp.string("Sprites/Default")));
      mat.method("set_color", 1).invoke(buttonColor);
    }

    // Add a collider so the raycast can hit it
    const col = btnGo.method("GetComponent", 1).inflate(BoxCollider).invoke();
    if (!col || col.handle.isNull()) {
       btnGo.method("AddComponent", 1).invoke(BoxCollider.type.object);
    }

    buttonsList.push({ go: btnGo, action: onClick, name: text });
  }

  function buildMenu() {
    menu = GameObject.method("CreatePrimitive", 1).invoke(3);
    menu.method("set_name", 1).invoke(Il2Cpp.string("GST_Menu"));
    const tr = menu.method("get_transform").invoke();
    tr.method("set_localScale", 1).invoke({ x: 0.7, y: 0.9, z: 0.02 });
    
    const rend = menu.method("GetComponent", 1).inflate(Renderer).invoke();
    if (rend) {
      const mat = rend.method("get_material").invoke();
      mat.method("set_shader", 1).invoke(Shader.method("Find", 1).invoke(Il2Cpp.string("Sprites/Default")));
      mat.method("set_color", 1).invoke(bgColor);
    }
    
    createButton(tr, "Godmode", 0.35, () => { S.godmode = !S.godmode; });
    createButton(tr, "Fly", 0.20, () => { S.fly = !S.fly; });
    createButton(tr, "Noclip", 0.05, () => { S.noclip = !S.noclip; });
    createButton(tr, "Kill All", -0.10, () => { doKillAll(); });
    createButton(tr, "TP All", -0.25, () => { doTpAll(); });
    createButton(tr, "Close", -0.40, () => { menu.method("SetActive", 1).invoke(false); });
  }

  buildMenu();

  // --- LASER POINTER ---
  function buildPointer() {
    pointerLine = GameObject.method("CreatePrimitive", 1).invoke(3);
    pointerLine.method("set_name", 1).invoke(Il2Cpp.string("GST_Laser"));
    const lr = pointerLine.method("AddComponent", 1).invoke(LineRenderer.type.object);
    if (lr) {
       lr.method("set_positionCount", 1).invoke(2);
       lr.method("set_startWidth", 1).invoke(0.01);
       lr.method("set_endWidth", 1).invoke(0.01);
       lr.method("set_startColor", 1).invoke({ r: 1, g: 0, b: 0, a: 1 });
       lr.method("set_endColor", 1).invoke({ r: 1, g: 0, b: 0, a: 1 });
       lr.method("set_material", 1).invoke(Shader.method("Find", 1).invoke(Il2Cpp.string("Sprites/Default")));
    }
  }
  buildPointer();

  // --- TICK ---
  setInterval(() => {
    if (!localPlayer || !menu) return;
    
    // Update Menu Position
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

    // Update Raycast
    if (pointerLine) {
       try {
          const head = localPlayer.method("get_transform").invoke();
          const startPos = head.method("get_position").invoke();
          const fwd = head.method("get_forward").invoke();
          
          // Hardcoded raycast distance
          const hitBuffer = Il2Cpp.alloc(128);
          const hitRef = Il2Cpp.reference(hitBuffer);
          
          const hit = Physics.method("Raycast", 6).overload("UnityEngine.Vector3", "UnityEngine.Vector3", "UnityEngine.RaycastHit&", "System.Single", "System.Int32", "System.Int32")
              .invoke(startPos, fwd, hitRef, 2.0, -1, 2);
              
          let endPos = { x: startPos.field("x").value + fwd.field("x").value * 2, y: startPos.field("y").value + fwd.field("y").value * 2, z: startPos.field("z").value + fwd.field("z").value * 2 };
          
          if (hit) {
             endPos = hitRef.method("get_point", 0).invoke();
             
             // Check if we hit a button
             const hitObj = hitRef.method("get_collider", 0).invoke().method("get_gameObject", 0).invoke();
             for (const btn of buttonsList) {
                 if (btn.go.handle.equals(hitObj.handle)) {
                     // Click if trigger pulled
                     if (rightTrigger && !prevTrigger) {
                        btn.action();
                        logV("Clicked " + btn.name);
                     }
                 }
             }
          }
          
          const lr = pointerLine.method("GetComponent", 1).inflate(LineRenderer).invoke();
          if (lr) {
             lr.method("SetPosition", 2).invoke(0, startPos);
             lr.method("SetPosition", 2).invoke(1, endPos);
          }
       } catch(e) {}
    }

    // Read Oculus Trigger
    try {
      const OVR = AssemblyCSharp.tryClass("OVRInput");
      if (OVR) {
         const trig = OVR.method("Get", 2).invoke(1, 2); // 1 = PrimaryIndexTrigger, 2 = RTouch
         rightTrigger = Number(trig) > 0.5;
      }
    } catch(e) {}

    prevTrigger = rightTrigger;
  }, 50);

  logV("Menu Ready. Raycast Active.");
});
