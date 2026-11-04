/**
 * mestro_ac — Gold's Spooky Terror (GST) mod menu
 * Template cleaned from Animal Rivals layout — AR game logic removed.
 *
 * Load (Quest / Frida):
 *   frida -n "<GST process>" -l frida-il2cpp-bridge.js -l mestro_ac_gst.ts
 *
 * Or gadget: drop next to bridge and set the script name in config.
 *
 * First run prints [GST] class hits — send those logs if spawn/fly need tighter hooks.
 */

const MENU_TITLE = "mestro_ac spooky terror menu";
const MENU_VERSION = "0.7.0";
const DISCORD_URL = "https://discord.gg/yCYvfDaa8";
const SERVER_URL = "https://web-production-51054.up.railway.app";
// KEY_BUILD: true = require key + link device | false = open menu
const KEY_BUILD = false;


function ref(v) {
  return { v: v };
}

const S = {
  // Movement
  platforms: ref(false),
  triggerFly: ref(false),
  joystickFly: ref(false),
  noclipFly: ref(false),
  noclip: ref(false),
  superJump: ref(false),
  speedBoost: ref(false),
  speedMult: ref(2.5),
  longArms: ref(false),
  armScale: ref(2.5),
  flySpeed: ref(8),
  jumpMult: ref(5),
  flyHoldAny: ref(false), // menu toggle = always fly while on (any-button mode helper)

  // Spawning
  spawnGun: ref(false),
  spawnSel: ref(0),
  laserThick: ref(0.08),

  // Server
  orbitAll: ref(false),
  orbitRadius: ref(3),
  orbitSpeed: ref(1.2),
  orbitHeight: ref(1.2),

  // Overpowered
  godmode: ref(false),
  flingGun: ref(false),
  zeroGGun: ref(false),
  flyGun: ref(false),
  crashGun: ref(false),
  crashAll: ref(false),
  tpAllGun: ref(false),
  pullGun: ref(false),
  blackScreenGun: ref(false),
  antiBan: ref(false),
  eventSel: ref(0),
  freezeMonsters: ref(false),
  invis: ref(false),
  giveGodGun: ref(false),
  killPlayer: ref(false),
  killGun: ref(false),
  spoofId: ref(false),
  spoofIdText: ref("mestro_ac"),
  flingAll: ref(false),
  summonWave: ref(false),
  mirrorCam: ref(false),
  sizeChanger: ref(false),
  sizeScale: ref(1),
  monsterEspDist: ref(true),
  propNoclip: ref(false),
  stealthMenu: ref(true),

  // Prefab gun
  prefabGun: ref(false),
  prefabSel: ref(0),

  // Visual ESP
  espPlayers: ref(false),
  espMonsters: ref(false),
  espTraces: ref(false),

  // Soundboard
  sbVol: ref(1),
  sbVolLevel: ref(10), // 1-10, 10 = super loud
  sbOthers: ref(true),
  sbSelf: ref(true),
  sbSel: ref(0),
  sbAuto: ref(true),

  gunPointer: ref(true),
};

// Prefab names copied from Animal Rivals spawn table (starting point).
// GST live scan replaces/extends this when Rescan runs in-game.
const AR_PREFAB_LIST = [
  "NetworkObject",
  "HealthPack",
  "BasicEnemy_01_BLUEPRINT",
  "BasicEnemy_02",
  "BasicEnemy_AR_Avatar",
  "BasicEnemy_AR_BigZombie",
  "BasicEnemy_AR_Zombie",
  "Enemy_RedDash Variant",
  "BasicEnemy_AR_Avatar1",
  "geyser",
  "NetworkPlayer",
  "NetworkedGrabbableItem",
  "SportsBasketball",
  "SportsHockeyPuck",
  "SportsSoccerBall",
  "VFX_CoinsEffect",
  "FlashbangProjectile",
  "FragGrenadeProjectile",
  "SmokeGrenadeProjectile",
  "StickyFragProjectile",
  "CannonWorldItem",
  "BattleRoyaleChest",
  "CritPowerup",
  "DamagePowerup",
  "HealthRestorePowerup",
  "MaxHealthPowerup",
  "SpeedPowerup",
  "DisappearingPlatform",
  "TriggeredDisappearingPlatform",
  "FusionAvatar",
  "NetworkedRig"
];

const STATE = {
  ready: false,
  lastLog: 0,
  platL: null,
  platR: null,
  laserGo: null,
  zeroG: new Set(),
  flyGift: new Set(),
  knownMonsters: [],
  knownPlayers: [],
  orbitT: 0,
  scanAbort: false,
  scanning: false,
};

function log(msg) {
  try {
    if (S && S.stealthMenu && S.stealthMenu.v) {
      // minimal logging when stealth on
      if (String(msg).indexOf("ERR") < 0 && String(msg).indexOf("ready") < 0) return;
    }
  } catch (e) {}
  console.log("[GST] " + msg);
}

function errOnce(tag, e) {
  const k = "_e_" + tag;
  if (STATE[k]) return;
  STATE[k] = true;
  console.log("[GST:ERR] " + tag + ": " + e);
}

/* ── IL2CPP helpers ─────────────────────────────────────────── */

function asmImage(name) {
  try {
    return Il2Cpp.domain.assembly(name).image;
  } catch (e) {
    try {
      return Il2Cpp.domain.tryAssembly(name)?.image;
    } catch (e2) {
      return null;
    }
  }
}

function findClass(name) {
  const imgs = [
    asmImage("Assembly-CSharp"),
    asmImage("Assembly-CSharp-firstpass"),
    asmImage("PhotonUnityNetworking"),
    asmImage("Fusion.Runtime"),
    asmImage("UnityEngine.CoreModule"),
    asmImage("UnityEngine.PhysicsModule"),
  ];
  for (const img of imgs) {
    if (!img) continue;
    try {
      const c = img.tryClass(name);
      if (c) return c;
    } catch (e) {}
  }
  try {
    return Il2Cpp.domain.assembly("Assembly-CSharp").image.class(name);
  } catch (e) {
    return null;
  }
}

function newGO(name) {
  const GO = findClass("UnityEngine.GameObject");
  return GO.method(".ctor", 1).invoke(Il2Cpp.string(name));
}

function addComp(go, cls) {
  try {
    return go.method("AddComponent", 1).invoke(cls.type.object);
  } catch (e) {
    try {
      return go.method("AddComponent").inflate(cls).invoke();
    } catch (e2) {
      return null;
    }
  }
}

function getTransform(go) {
  return go.method("get_transform").invoke();
}

function setPos(tr, x, y, z) {
  try {
    const V3 = findClass("UnityEngine.Vector3");
    const v = V3.alloc();
    v.field("x").value = x;
    v.field("y").value = y;
    v.field("z").value = z;
    tr.method("set_position").invoke(v);
  } catch (e) {
    try {
      tr.method("set_position").invoke({ x: x, y: y, z: z });
    } catch (e2) {
      errOnce("setPos", e2);
    }
  }
}

function getPos(tr) {
  try {
    const p = tr.method("get_position").invoke();
    return { x: p.field("x").value, y: p.field("y").value, z: p.field("z").value };
  } catch (e) {
    return { x: 0, y: 0, z: 0 };
  }
}

/* ── Discovery (prints GST-ish classes once) ────────────────── */

function discover() {
  try {
    STATE.scanAbort = false;
    STATE.scanning = true;
    const t0 = Date.now();
    const img = asmImage("Assembly-CSharp");
    if (!img) {
      log("Assembly-CSharp missing");
      STATE.scanning = false;
      return;
    }
    const hits = [];
    const monsterHits = [];
    const playerHits = [];
    const eventClassHits = [];
    // single pass — faster than multiple filters
    const classes = img.classes;
    const n = classes.length;
    for (let i = 0; i < n; i++) {
      if (STATE.scanAbort) {
        log("scan stopped by user at class " + i + "/" + n);
        break;
      }
      let c;
      try { c = classes[i]; } catch (e) { continue; }
      const name = c.name;
      const low = name.toLowerCase();
      let any = false;
      if (low.indexOf("monster") >= 0 || low.indexOf("enemy") >= 0 || low.indexOf("creature") >= 0 || low.indexOf("spook") >= 0 || low.indexOf("bot") >= 0 || low.indexOf("npc") >= 0 || low.indexOf("ai") >= 0) {
        monsterHits.push(name); any = true;
      }
      if (low.indexOf("player") >= 0 || low.indexOf("rig") >= 0 || low.indexOf("gorilla") >= 0) {
        playerHits.push(name); any = true;
      }
      if (low.indexOf("event") >= 0 || low.indexOf("round") >= 0 || low.indexOf("wave") >= 0 || low.indexOf("spawner") >= 0 || low.indexOf("manager") >= 0 || low.indexOf("activity") >= 0 || low.indexOf("phase") >= 0 || low.indexOf("director") >= 0 || low.indexOf("flow") >= 0 || low.indexOf("gamemode") >= 0) {
        eventClassHits.push(name); any = true;
      }
      if (any) hits.push(name);
    }
    STATE.knownMonsters = monsterHits;
    STATE.knownPlayers = playerHits;
    STATE.knownEvents = eventClassHits;
    // Fast event methods: only scan event-related classes (not entire image methods)
    STATE.eventMethods = [];
    const targets = eventClassHits.length ? eventClassHits : hits;
    const maxClasses = Math.min(targets.length, 80); // cap for speed
    for (let i = 0; i < maxClasses; i++) {
      if (STATE.scanAbort) break;
      try {
        const c = img.tryClass(targets[i]);
        if (!c) continue;
        const methods = c.methods;
        const ml = methods.length;
        for (let j = 0; j < ml; j++) {
          let m;
          try { m = methods[j]; } catch (e) { continue; }
          const mn = m.name;
          if (!/start|begin|trigger|raise|launch|spawn|activate|play|run|invoke|fire|startwave|spawnwave|nextevent/i.test(mn)) continue;
          if (m.parameterCount > 2) continue;
          const label = c.name + "." + mn + (m.parameterCount ? ("(" + m.parameterCount + ")") : "()");
          STATE.eventMethods.push(label);
        }
      } catch (e) {}
    }
    STATE.eventMethods.sort();
    // Monster spawn candidates = monster classes themselves
    STATE.spawnMonsterNames = monsterHits.slice(0, 60);
    const ms = Date.now() - t0;
    STATE.scanning = false;
    if (STATE.scanAbort) {
      log("scan ABORTED " + ms + "ms | partial monsters " + monsterHits.length + " | events " + (STATE.eventMethods || []).length);
    } else {
      log("scan " + ms + "ms | monsters " + monsterHits.length + " | events " + (STATE.eventMethods || []).length + " | classes " + hits.length);
    }
  } catch (e) {
    STATE.scanning = false;
    errOnce("discover", e);
  }
}

/* ── Local player / camera ──────────────────────────────────── */

function localPlayer() {
  // Generic probes — tighten when discovery logs land
  const names = [
    "GorillaLocomotion.Player",
    "Player",
    "LocalPlayer",
    "GSTPlayer",
    "NetworkPlayer",
    "VRRig",
  ];
  for (const n of names) {
    try {
      const c = findClass(n);
      if (!c) continue;
      for (const m of ["get_Instance", "Instance", "get_LocalPlayer"]) {
        try {
          const inst = c.method(m).invoke();
          if (inst && !inst.handle.isNull()) return inst;
        } catch (e) {}
      }
      try {
        const f = c.field("Instance") || c.field("<Instance>k__BackingField");
        if (f && f.value && !f.value.handle.isNull()) return f.value;
      } catch (e) {}
    } catch (e) {}
  }
  return null;
}

function headTransform() {
  try {
    const cam = findClass("UnityEngine.Camera");
    const main = cam.method("get_main").invoke();
    if (main && !main.handle.isNull()) return main.method("get_transform").invoke();
  } catch (e) {}
  const p = localPlayer();
  if (!p) return null;
  try {
    return p.method("get_transform").invoke();
  } catch (e) {
    return null;
  }
}

function rightHandTransform() {
  // OVR / XR hand probes
  const names = ["OVRCameraRig", "VRRig", "GorillaLocomotion.Player"];
  // fallback: camera forward as aim
  return null;
}

/* ── Controller input (Quest) ───────────────────────────────── */

function ovrDown(button) {
  try {
    const OVR = findClass("OVRInput");
    if (!OVR) return false;
    // RawButton / Button enums vary; try common trigger
    return !!OVR.method("Get", 1).invoke(button);
  } catch (e) {
    return false;
  }
}

function triggerHeld() {
  // Fly hold: trigger OR Y / X / B / A / grip — any of these works
  try {
    const OVR = findClass("OVRInput");
    if (!OVR) return false;
    // Axis triggers
    for (const hand of [2, 1, 0]) {
      try {
        const v = OVR.method("Get", 2).invoke(1, hand);
        if (typeof v === "number" && v > 0.55) return true;
      } catch (e) {}
    }
    // Button bits — try a range of RawButton / Button enums (Y, X, B, A, grips)
    // Common OVR RawButton values vary by version; probe several ints
    const candidates = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
    for (const btn of candidates) {
      for (const hand of [1, 2, 0]) {
        try {
          const down = OVR.method("Get", 2).invoke(btn, hand);
          if (down === true || down === 1) return true;
        } catch (e) {}
        try {
          const down = OVR.method("GetDown", 2).invoke(btn, hand);
          if (down === true || down === 1) return true;
        } catch (e) {}
      }
    }
    // Unity XR InputDevices fallback via Java is too heavy — stick to OVR
  } catch (e) {}
  // Manual hold toggle from menu
  if (S.flyHoldAny && S.flyHoldAny.v) return true;
  return false;
}

function thumbstick() {
  try {
    const OVR = findClass("OVRInput");
    // return {x,y} best effort
    for (const hand of [2, 1]) {
      try {
        const v = OVR.method("Get", 2).invoke(1, hand);
        if (v && typeof v === "object") {
          return {
            x: v.field ? v.field("x").value : v.x || 0,
            y: v.field ? v.field("y").value : v.y || 0,
          };
        }
      } catch (e) {}
    }
  } catch (e) {}
  return { x: 0, y: 0 };
}




function tickFlingAll() {
  if (!S.flingAll.v) return;
  if (STATE._flingCd && Date.now() - STATE._flingCd < 800) return;
  STATE._flingCd = Date.now();
  try {
    const players = allPlayers();
    for (const pl of players) {
      try {
        const rb = pl.method("GetComponent").inflate(findClass("UnityEngine.Rigidbody")).invoke();
        if (rb) {
          try {
            rb.method("set_velocity").invoke({ x: (Math.random() - 0.5) * 40, y: 25, z: (Math.random() - 0.5) * 40 });
          } catch (e) {}
          try {
            rb.method("AddForce").invoke({ x: (Math.random() - 0.5) * 80, y: 50, z: (Math.random() - 0.5) * 80 });
          } catch (e) {}
        }
        const tr = pl.method("get_transform").invoke();
        const pp = getPos(tr);
        setPos(tr, pp.x, pp.y + 5, pp.z);
      } catch (e) {}
    }
    // also fling monsters
    const names = STATE.knownMonsters.length ? STATE.knownMonsters : ["Monster", "Enemy"];
    for (const n of names) {
      try {
        const cls = findClass(n);
        if (!cls) continue;
        const GO = findClass("UnityEngine.Object");
        let arr = null;
        try { arr = GO.method("FindObjectsOfType").inflate(cls).invoke(); } catch (e) {}
        if (!arr || !arr.length) continue;
        for (let i = 0; i < arr.length; i++) {
          let obj = null;
          try { obj = arr.get ? arr.get(i) : arr[i]; } catch (e) {}
          if (!obj) continue;
          try {
            const tr = obj.method("get_transform").invoke();
            const pp = getPos(tr);
            setPos(tr, pp.x + (Math.random() - 0.5) * 10, pp.y + 8, pp.z + (Math.random() - 0.5) * 10);
          } catch (e) {}
        }
      } catch (e) {}
    }
  } catch (e) {
    errOnce("flingAll", e);
  }
}

function tickSizeChanger() {
  if (!S.sizeChanger.v) return;
  try {
    const p = localPlayer();
    if (!p) return;
    const s = Math.max(0.1, Math.min(10, +S.sizeScale.v || 1));
    const tr = p.method("get_transform").invoke();
    try {
      tr.method("set_localScale").invoke({ x: s, y: s, z: s });
    } catch (e) {
      try {
        const V3 = findClass("UnityEngine.Vector3");
        // fallback
      } catch (e2) {}
    }
  } catch (e) {
    errOnce("size", e);
  }
}

function tickMirror() {
  if (!S.mirrorCam.v) return;
  // soft third-person: pull main camera back along -forward
  try {
    const cam = findClass("UnityEngine.Camera");
    const main = cam.method("get_main").invoke();
    if (!main) return;
    const tr = main.method("get_transform").invoke();
    const p = localPlayer();
    if (!p) return;
    const pt = p.method("get_transform").invoke();
    const pp = getPos(pt);
    const fwd = pt.method("get_forward").invoke();
    const fx = fwd.field("x").value, fy = fwd.field("y").value, fz = fwd.field("z").value;
    setPos(tr, pp.x - fx * 3, pp.y + 1.5 - fy * 0.2, pp.z - fz * 3);
  } catch (e) {
    errOnce("mirror", e);
  }
}

function tickPropNoclip() {
  if (!S.propNoclip.v && !S.noclip.v) return;
  try {
    const p = localPlayer();
    if (!p) return;
    // disable collisions on player colliders
    try {
      const colCls = findClass("UnityEngine.Collider");
      const cols = p.method("GetComponentsInChildren").inflate(colCls).invoke();
      // try length
      const n = cols && (cols.length || 0);
      for (let i = 0; i < n; i++) {
        let c = null;
        try { c = cols.get ? cols.get(i) : cols[i]; } catch (e) {}
        if (!c) continue;
        try { c.method("set_enabled").invoke(false); } catch (e) {}
        try { c.method("set_isTrigger").invoke(true); } catch (e) {}
      }
    } catch (e) {}
    try {
      const rb = p.method("GetComponent").inflate(findClass("UnityEngine.Rigidbody")).invoke();
      if (rb) {
        try { rb.method("set_detectCollisions").invoke(false); } catch (e) {}
      }
    } catch (e) {}
  } catch (e) {
    errOnce("propNoclip", e);
  }
}

function tpMonstersToMe() {
  try {
    const me = headTransform();
    if (!me) return "no player";
    const mp = getPos(me);
    const names = STATE.knownMonsters.length ? STATE.knownMonsters : ["Monster", "Enemy", "Creature"];
    let n = 0;
    for (const name of names) {
      try {
        const cls = findClass(name);
        if (!cls) continue;
        const GO = findClass("UnityEngine.Object");
        let arr = null;
        try { arr = GO.method("FindObjectsOfType").inflate(cls).invoke(); } catch (e) {}
        if (!arr) continue;
        const len = arr.length || 0;
        for (let i = 0; i < len; i++) {
          let obj = null;
          try { obj = arr.get ? arr.get(i) : arr[i]; } catch (e) {}
          if (!obj) continue;
          try {
            const tr = obj.method("get_transform").invoke();
            setPos(tr, mp.x + (Math.random() - 0.5) * 2, mp.y, mp.z + (Math.random() - 0.5) * 2);
            n++;
          } catch (e) {}
        }
      } catch (e) {}
    }
    return "tp'd " + n + " monsters to you";
  } catch (e) {
    return "tp monsters failed";
  }
}

function tpMeToNearestMonster() {
  try {
    const me = localPlayer();
    if (!me) return "no player";
    const mt = me.method("get_transform").invoke();
    const mp = getPos(mt);
    let best = null, bestD = 1e9;
    const names = STATE.knownMonsters.length ? STATE.knownMonsters : ["Monster", "Enemy", "Creature"];
    for (const name of names) {
      try {
        const cls = findClass(name);
        if (!cls) continue;
        const GO = findClass("UnityEngine.Object");
        let arr = null;
        try { arr = GO.method("FindObjectsOfType").inflate(cls).invoke(); } catch (e) {}
        if (!arr) continue;
        const len = arr.length || 0;
        for (let i = 0; i < len; i++) {
          let obj = null;
          try { obj = arr.get ? arr.get(i) : arr[i]; } catch (e) {}
          if (!obj) continue;
          try {
            const tr = obj.method("get_transform").invoke();
            const pp = getPos(tr);
            const d = (pp.x - mp.x) ** 2 + (pp.y - mp.y) ** 2 + (pp.z - mp.z) ** 2;
            if (d < bestD) { bestD = d; best = pp; }
          } catch (e) {}
        }
      } catch (e) {}
    }
    if (!best) return "no monsters found — rescan classes";
    setPos(mt, best.x, best.y + 1, best.z);
    return "tp to monster (~" + Math.sqrt(bestD).toFixed(1) + "m)";
  } catch (e) {
    return "tp failed";
  }
}

function summonWave() {
  S.summonWave.v = true;
  // reuse event starter with wave-like names
  try {
    const prev = S.eventSel.v;
    const evs = eventCatalog();
    let idx = evs.findIndex((e) => /wave|spawn|monster|round/i.test(e));
    if (idx < 0) idx = 0;
    S.eventSel.v = idx;
    const msg = startSelectedEvent();
    S.eventSel.v = prev;
    // also try spawn a few from catalog at player
    const tr = headTransform();
    if (tr) {
      const pos = getPos(tr);
      const list = monsterCatalog();
      for (let i = 0; i < Math.min(5, list.length); i++) {
        spawnMonsterAt(list[i], {
          x: pos.x + (Math.random() - 0.5) * 6,
          y: pos.y,
          z: pos.z + (Math.random() - 0.5) * 6,
        });
      }
    }
    return msg || "summon wave attempted";
  } catch (e) {
    return "summon wave failed";
  }
}

function panicOff() {
  const keep = { gunPointer: 1, sbVol: 1, sbVolLevel: 1, sbOthers: 1, sbSelf: 1, sbAuto: 1 };
  for (const k of Object.keys(S)) {
    try {
      if (keep[k]) continue;
      if (S[k] && typeof S[k] === "object" && "v" in S[k]) {
        if (typeof S[k].v === "boolean") S[k].v = false;
      }
    } catch (e) {}
  }
  try { sbStop(); } catch (e) {}
  log("PANIC OFF — all mods disabled");
  return "all mods off";
}


function unfreezeMonsters() {
  S.freezeMonsters.v = false;
  try {
    const img = asmImage("Assembly-CSharp");
    const names = STATE.knownMonsters.length ? STATE.knownMonsters : ["Monster", "Enemy", "Creature"];
    for (const n of names) {
      try {
        const cls = findClass(n);
        if (!cls) continue;
        const GO = findClass("UnityEngine.Object");
        if (!GO) continue;
        let arr = null;
        try { arr = GO.method("FindObjectsOfType").inflate(cls).invoke(); } catch (e) {
          try { arr = GO.method("FindObjectsOfType", 1).invoke(cls.type.object); } catch (e2) {}
        }
        if (!arr) continue;
        const len = arr.length !== undefined ? arr.length : 0;
        for (let i = 0; i < len; i++) {
          let obj = null;
          try { obj = arr.get(i); } catch (e) { try { obj = arr[i]; } catch (e2) {} }
          if (!obj) continue;
          try {
            const rb = obj.method("GetComponent").inflate(findClass("UnityEngine.Rigidbody")).invoke();
            if (rb) {
              try { rb.method("set_isKinematic").invoke(false); } catch (e) {}
              try { rb.method("set_useGravity").invoke(true); } catch (e) {}
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
    log("monsters unfrozen");
    return "monsters unfrozen";
  } catch (e) {
    errOnce("unfreeze", e);
    return "unfreeze attempted";
  }
}

function tickFreezeMonsters() {
  if (!S.freezeMonsters.v) return;
  try {
    const img = asmImage("Assembly-CSharp");
    if (!img) return;
    // Freeze rigidbodies / AI on monster-like objects in scene
    const names = STATE.knownMonsters.length ? STATE.knownMonsters : ["Monster", "Enemy", "Creature"];
    for (const n of names) {
      try {
        const cls = findClass(n);
        if (!cls) continue;
        // FindObjectsOfType
        const GO = findClass("UnityEngine.Object");
        if (!GO) continue;
        let arr = null;
        try {
          arr = GO.method("FindObjectsOfType").inflate(cls).invoke();
        } catch (e) {
          try { arr = GO.method("FindObjectsOfType", 1).invoke(cls.type.object); } catch (e2) {}
        }
        if (!arr) continue;
        const len = arr.length !== undefined ? arr.length : (arr.get_Count ? arr.get_Count() : 0);
        for (let i = 0; i < (len || 0); i++) {
          let obj = null;
          try { obj = arr.get(i); } catch (e) {
            try { obj = arr[i]; } catch (e2) {}
          }
          if (!obj) continue;
          try {
            const rb = obj.method("GetComponent").inflate(findClass("UnityEngine.Rigidbody")).invoke();
            if (rb) {
              try { rb.method("set_isKinematic").invoke(true); } catch (e) {}
              try { rb.method("set_velocity").invoke({ x: 0, y: 0, z: 0 }); } catch (e) {}
            }
          } catch (e) {}
          // zero AI speed fields
          for (const f of ["speed", "moveSpeed", "agentSpeed", "chaseSpeed"]) {
            try {
              const field = obj.field(f);
              if (field && typeof field.value === "number") field.value = 0;
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    errOnce("freezeMonsters", e);
  }
}

function tickInvis() {
  if (!S.invis.v) return;
  try {
    const p = localPlayer();
    if (!p) return;
    // Disable renderers under local player
    try {
      const rend = p.method("GetComponentsInChildren").inflate(findClass("UnityEngine.Renderer")).invoke();
      // can't easily iterate without length API — try scale to 0
      const tr = p.method("get_transform").invoke();
      // soft invis: scale near zero on mesh children is risky; set layer or enabled false on renderers via loop
    } catch (e) {}
    for (const fname of ["visible", "isVisible", "showName", "nametagVisible"]) {
      try {
        const f = p.field(fname);
        if (f && typeof f.value === "boolean") f.value = false;
      } catch (e) {}
    }
    // network: try RPC hide if exists
  } catch (e) {
    errOnce("invis", e);
  }
}

function tickSpoofId() {
  if (!S.spoofId.v) return;
  try {
    const name = String(S.spoofIdText.v || "mestro_ac");
    const p = localPlayer();
    if (p) {
      for (const m of ["set_NickName", "SetNickName", "set_name", "SetName", "set_PlayerName"]) {
        try { p.method(m).invoke(Il2Cpp.string(name)); } catch (e) {}
      }
      for (const f of ["nickName", "playerName", "displayName", "Name", "userId", "UserId"]) {
        try {
          const field = p.field(f);
          if (field) {
            try { field.value = Il2Cpp.string(name); } catch (e) {
              try { field.value = name; } catch (e2) {}
            }
          }
        } catch (e) {}
      }
    }
    // PhotonNetwork.NickName
    try {
      const PN = findClass("PhotonNetwork") || findClass("Photon.Pun.PhotonNetwork");
      if (PN) {
        try { PN.method("set_NickName").invoke(Il2Cpp.string(name)); } catch (e) {}
        try { PN.field("nickName").value = Il2Cpp.string(name); } catch (e) {}
      }
    } catch (e) {}
  } catch (e) {
    errOnce("spoofId", e);
  }
}

/* ── Godmode / anti-ban / arms / speed ─────────────────────── */

function tickGodmode() {
  if (!S.godmode.v) return;
  try {
    const p = localPlayer();
    if (!p) return;
    // Common health / damage fields — best effort until GST HP class is known
    for (const fname of ["health", "Health", "currentHealth", "HP", "hp", "_health", "maxHealth"]) {
      try {
        const f = p.field(fname);
        if (f) {
          const v = f.value;
          if (typeof v === "number" && v < 99999) f.value = 999999;
        }
      } catch (e) {}
    }
    for (const m of ["set_Health", "SetHealth", "Revive", "ResetHealth"]) {
      try { p.method(m).invoke(999999); } catch (e) {}
    }
    // ignore damage RPCs when antiBan also useful
  } catch (e) {
    errOnce("godmode", e);
  }
}

function installAntiBan() {
  if (STATE._antiBan) return;
  STATE._antiBan = true;
  try {
    const names = ["RPC_Client_Kick", "RPC_Kick", "KickPlayer", "BanPlayer", "RPC_Ban"];
    const img = asmImage("Assembly-CSharp");
    if (!img) return;
    img.classes.forEach((c) => {
      try {
        c.methods.forEach((m) => {
          const n = m.name;
          if (!/kick|ban|disconnect|forceleave/i.test(n)) return;
          try {
            m.implementation = function () {
              if (S.antiBan.v) {
                log("anti-ban blocked " + c.name + "." + n);
                return;
              }
              return m.invoke.apply(this, arguments);
            };
          } catch (e) {}
        });
      } catch (e) {}
    });
    log("anti-ban hooks attempted");
  } catch (e) {
    errOnce("antiBan", e);
  }
}

function tickSpeed() {
  if (!S.speedBoost.v) return;
  try {
    const p = localPlayer();
    if (!p) return;
    const mult = Math.max(1, +S.speedMult.v || 2.5);
    for (const fname of ["maxJumpSpeed", "maxJumpSpeed", "jumpMultiplier", "moveSpeed", "speed", "MaxSpeed", "locomotionSpeed"]) {
      try {
        const f = p.field(fname);
        if (f && typeof f.value === "number") {
          if (!STATE._baseSpeed) STATE._baseSpeed = {};
          if (STATE._baseSpeed[fname] == null) STATE._baseSpeed[fname] = f.value;
          f.value = STATE._baseSpeed[fname] * mult;
        }
      } catch (e) {}
    }
  } catch (e) {
    errOnce("speed", e);
  }
}

function tickLongArms() {
  if (!S.longArms.v) return;
  try {
    const p = localPlayer();
    if (!p) return;
    const scale = Math.max(1, +S.armScale.v || 2.5);
    // scale arm transforms if present
    for (const path of ["leftHandTransform", "rightHandTransform", "leftHand", "rightHand"]) {
      try {
        const f = p.field(path);
        if (!f || !f.value) continue;
        const tr = f.value;
        const s = tr.method ? tr : tr.method && tr;
        // if it's a transform
        try {
          const V3 = findClass("UnityEngine.Vector3");
          // set localScale
          tr.method("set_localScale").invoke({ x: scale, y: scale, z: scale });
        } catch (e) {}
      } catch (e) {}
    }
  } catch (e) {
    errOnce("longArms", e);
  }
}

/* ── Soundboard ────────────────────────────────────────────── */

const SB = {
  files: [],
  at: 0,
  status: "scan folders",
  folders: [],
};




/* ── Movement ───────────────────────────────────────────────── */

function tickFly() {
  const tr = headTransform();
  if (!tr) return;
  const speed = Math.max(1, +S.flySpeed.v || 8) * 0.05;
  const pos = getPos(tr);

  if (S.triggerFly.v && triggerHeld()) {
    // move along look direction
    try {
      const fwd = tr.method("get_forward").invoke();
      const fx = fwd.field("x").value;
      const fy = fwd.field("y").value;
      const fz = fwd.field("z").value;
      setPos(tr, pos.x + fx * speed * 3, pos.y + fy * speed * 3, pos.z + fz * speed * 3);
      // also push player body if separate
      const p = localPlayer();
      if (p) {
        try {
          const pt = p.method("get_transform").invoke();
          const pp = getPos(pt);
          setPos(pt, pp.x + fx * speed * 3, pp.y + fy * speed * 3, pp.z + fz * speed * 3);
        } catch (e) {}
      }
    } catch (e) {
      errOnce("triggerFly", e);
    }
  }

  if (S.joystickFly.v) {
    const st = thumbstick();
    try {
      const fwd = tr.method("get_forward").invoke();
      const right = tr.method("get_right").invoke();
      const fx = fwd.field("x").value,
        fz = fwd.field("z").value;
      const rx = right.field("x").value,
        rz = right.field("z").value;
      const dx = (rx * st.x + fx * st.y) * speed * 4;
      const dz = (rz * st.x + fz * st.y) * speed * 4;
      const dy = st.y * 0; // horizontal stick fly; hold trigger fly for vertical
      const p = localPlayer();
      const body = p ? p.method("get_transform").invoke() : tr;
      const pp = getPos(body);
      setPos(body, pp.x + dx, pp.y + dy, pp.z + dz);
    } catch (e) {
      errOnce("jfly", e);
    }
  }

  if (S.noclipFly.v && triggerHeld()) {
    S.noclip.v = true;
    // same as trigger fly
    S.triggerFly.v = true;
    tickFly._nf = true;
  }
}

function tickNoclip() {
  if (!S.noclip.v && !S.noclipFly.v) return;
  try {
    const p = localPlayer();
    if (!p) return;
    // disable colliders under player
    const cols = p.method("GetComponentsInChildren").inflate(findClass("UnityEngine.Collider")).invoke();
    // fallback: set rigidbody kinematic / no gravity
    try {
      const rb = p.method("GetComponent").inflate(findClass("UnityEngine.Rigidbody")).invoke();
      if (rb) {
        rb.method("set_detectCollisions").invoke(false);
        rb.method("set_useGravity").invoke(false);
      }
    } catch (e) {}
  } catch (e) {
    errOnce("noclip", e);
  }
}

function tickSuperJump() {
  if (!S.superJump.v) return;
  // scale jump impulse when jump pressed — game-specific; placeholder multiplies upward velocity
  try {
    const p = localPlayer();
    if (!p) return;
    const rb = p.method("GetComponent").inflate(findClass("UnityEngine.Rigidbody")).invoke();
    if (!rb) return;
    // if upward motion small and jump intent, boost
    const v = rb.method("get_velocity").invoke();
    const vy = v.field("y").value;
    if (vy > 0.2 && vy < 3) {
      v.field("y").value = vy * Math.max(1, +S.jumpMult.v || 5);
      rb.method("set_velocity").invoke(v);
    }
  } catch (e) {
    errOnce("superJump", e);
  }
}

function tickPlatforms() {
  if (!S.platforms.v) {
    // hide if exist
    return;
  }
  // Simple: spawn cubes under hands when grip — full hand tracking needs GST rig fields
  // Placeholder logs once
  if (!STATE._platNote) {
    STATE._platNote = true;
    log("platforms ON — needs hand transforms from discovery (send [GST] class hits)");
  }
}

/* ── Spawning monsters ──────────────────────────────────────── */

function monsterCatalog() {
  if (STATE.spawnMonsterNames && STATE.spawnMonsterNames.length) return STATE.spawnMonsterNames;
  if (STATE.knownMonsters && STATE.knownMonsters.length) return STATE.knownMonsters.slice(0, 60);
  return [
    "(no GST monsters yet — open Monsters tab → Scan Monsters)",
  ];
}

function stopScan() {
  STATE.scanAbort = true;
  STATE.scanning = false;
  log("stop scan requested");
  return "scan stop requested";
}

function scanMonsters() {
  const t0 = Date.now();
  discover();
  const n = (STATE.spawnMonsterNames && STATE.spawnMonsterNames.length) || (STATE.knownMonsters && STATE.knownMonsters.length) || 0;
  return "monsters: " + n + " (" + (Date.now() - t0) + "ms)";
}

function prefabCatalog() {
  // Live GST prefabs if discovered later; else AR list as template names
  if (STATE.knownPrefabs && STATE.knownPrefabs.length) return STATE.knownPrefabs;
  return AR_PREFAB_LIST;
}

function spawnMonsterAt(name, pos) {
  // Network-visible spawn needs the game's own spawn RPC / Photon instantiate
  // We try common patterns then log
  try {
    const cls = findClass(name);
    if (!cls) {
      log("spawn: class not found " + name);
      return false;
    }
    // Try PhotonNetwork.Instantiate
    const PN = findClass("PhotonNetwork") || findClass("Photon.Pun.PhotonNetwork");
    if (PN) {
      try {
        const method = PN.method("Instantiate");
        // signature varies — attempt string path
        log("spawn: PhotonNetwork present — wire prefab path for " + name);
      } catch (e) {}
    }
    log("spawn attempt " + name + " @ " + pos.x.toFixed(1) + "," + pos.y.toFixed(1) + "," + pos.z.toFixed(1));
    return true;
  } catch (e) {
    errOnce("spawn", e);
    return false;
  }
}

function tickSpawnGun() {
  if (!S.spawnGun.v) return;
  if (!triggerHeld()) return;
  if (STATE._spawnCd && Date.now() - STATE._spawnCd < 400) return;
  STATE._spawnCd = Date.now();
  const tr = headTransform();
  if (!tr) return;
  try {
    const pos = getPos(tr);
    const fwd = tr.method("get_forward").invoke();
    const dist = 6;
    const tx = pos.x + fwd.field("x").value * dist;
    const ty = pos.y + fwd.field("y").value * dist;
    const tz = pos.z + fwd.field("z").value * dist;
    const list = monsterCatalog();
    const idx = Math.max(0, Math.min(list.length - 1, S.spawnSel.v));
    spawnMonsterAt(list[idx], { x: tx, y: ty, z: tz });
  } catch (e) {
    errOnce("spawnGun", e);
  }
}

function tickLaserVisual() {
  // Visual-only thick blue line along look when any gun is on
  if (!(S.spawnGun.v || S.flingGun.v || S.zeroGGun.v || S.flyGun.v || S.crashGun.v)) return;
  // Drawing a true LineRenderer each frame is heavy without cached comps —
  // log once that pointer is active; full laser mesh can be filled after discovery
  if (!STATE._laserNote) {
    STATE._laserNote = true;
    log("laser pointer active (blue thick) — LineRenderer hook pending GST camera rig");
  }
}

/* ── Server / players ───────────────────────────────────────── */

function allPlayers() {
  // Return array of player objects — filled after discovery
  const out = [];
  try {
    const names = ["Player", "NetworkPlayer", "VRRig", "GSTPlayer"];
    // Without room manager we can't enumerate yet
  } catch (e) {}
  return out;
}

function trySetMasterClient() {
  try {
    const PN = findClass("PhotonNetwork") || findClass("Photon.Pun.PhotonNetwork");
    if (!PN) return false;
    try {
      PN.method("SetMasterClient").invoke(PN.method("get_LocalPlayer").invoke());
      return true;
    } catch (e) {}
  } catch (e) {}
  return false;
}

function tickOrbit() {
  if (!S.orbitAll.v) return;
  STATE.orbitT += 0.016 * (+S.orbitSpeed.v || 1.2);
  const me = headTransform();
  if (!me) return;
  const c = getPos(me);
  const players = allPlayers();
  const n = Math.max(1, players.length);
  for (let i = 0; i < players.length; i++) {
    try {
      const ang = STATE.orbitT + (i * 6.28318) / n;
      const r = +S.orbitRadius.v || 3;
      const x = c.x + Math.cos(ang) * r;
      const z = c.z + Math.sin(ang) * r;
      const y = c.y + (+S.orbitHeight.v || 1.2);
      const tr = players[i].method("get_transform").invoke();
      setPos(tr, x, y, z);
    } catch (e) {}
  }
}

/* ── OP guns ────────────────────────────────────────────────── */

function aimTargetPlayer() {
  // Cone aim from head forward — needs player list
  return null;
}

function tickGuns() {
  if (!triggerHeld()) return;
  if (STATE._gunCd && Date.now() - STATE._gunCd < 300) return;
  const target = aimTargetPlayer();
  if (S.flingGun.v) {
    STATE._gunCd = Date.now();
    if (target) {
      try {
        const rb = target.method("GetComponent").inflate(findClass("UnityEngine.Rigidbody")).invoke();
        if (rb) {
          const tr = headTransform();
          const fwd = tr.method("get_forward").invoke();
          // apply force
          log("fling gun fired");
        }
      } catch (e) {}
    }
  }
  if (S.crashGun.v) {
    STATE._gunCd = Date.now();
    log("crash gun fire (needs player RPC)");
  }
  if (S.zeroGGun.v) {
    STATE._gunCd = Date.now();
    log("zero-g gun fire");
  }
  if (S.flyGun.v) {
    STATE._gunCd = Date.now();
    log("fly gun — marks remote for fly gift when net path exists");
  }
  if (S.pullGun.v) {
    STATE._gunCd = Date.now();
    try {
      const me = headTransform();
      const mp = getPos(me);
      const players = allPlayers();
      for (const pl of players) {
        try {
          const pt = pl.method("get_transform").invoke();
          const pp = getPos(pt);
          setPos(pt, mp.x * 0.3 + pp.x * 0.7, mp.y * 0.3 + pp.y * 0.7, mp.z * 0.3 + pp.z * 0.7);
        } catch (e) {}
      }
      log("pull gun pulse players=" + players.length);
    } catch (e) {
      errOnce("pullGun", e);
    }
  }
  if (S.blackScreenGun.v) {
    STATE._gunCd = Date.now();
    log("black screen gun — needs GST fullscreen overlay RPC");
  }
  if (S.giveGodGun.v) {
    STATE._gunCd = Date.now();
    log("give godmode gun — marks aimed player when enum exists");
  }
  if (S.killGun.v || S.killPlayer.v) {
    STATE._gunCd = Date.now();
    try {
      const players = allPlayers();
      for (const pl of players) {
        try {
          for (const m of ["RPC_ReportHealthUsed", "TakeDamage", "Kill", "RPC_Kill", "Die"]) {
            try { pl.method(m).invoke(999999); } catch (e) {}
          }
        } catch (e) {}
      }
      log("kill player pulse count=" + players.length);
    } catch (e) {
      errOnce("killPlayer", e);
    }
  }
  if (S.tpAllGun.v) {
    STATE._gunCd = Date.now();
    // TP everyone to laser hit point in front of aim
    try {
      const tr = headTransform();
      if (!tr) return;
      const pos = getPos(tr);
      const fwd = tr.method("get_forward").invoke();
      const hit = {
        x: pos.x + fwd.field("x").value * 8,
        y: pos.y + fwd.field("y").value * 8,
        z: pos.z + fwd.field("z").value * 8,
      };
      const players = allPlayers();
      for (const pl of players) {
        try {
          const pt = pl.method("get_transform").invoke();
          setPos(pt, hit.x, hit.y, hit.z);
        } catch (e) {}
      }
      log("tp-all gun → " + hit.x.toFixed(1) + "," + hit.y.toFixed(1) + "," + hit.z.toFixed(1) + " players=" + players.length);
    } catch (e) {
      errOnce("tpAllGun", e);
    }
  }
  if (S.prefabGun.v) {
    STATE._gunCd = Date.now();
    const list = prefabCatalog();
    const idx = Math.max(0, Math.min(list.length - 1, S.prefabSel.v));
    try {
      const tr = headTransform();
      const pos = getPos(tr);
      const fwd = tr.method("get_forward").invoke();
      spawnMonsterAt(list[idx], {
        x: pos.x + fwd.field("x").value * 5,
        y: pos.y + fwd.field("y").value * 5,
        z: pos.z + fwd.field("z").value * 5,
      });
    } catch (e) {
      errOnce("prefabGun", e);
    }
  }
}

function tickCrashAll() {
  if (!S.crashAll.v) return;
  if (STATE._crashCd && Date.now() - STATE._crashCd < 1000) return;
  STATE._crashCd = Date.now();
  log("crash all pulse");
}

/* ── ESP ────────────────────────────────────────────────────── */

function tickEsp() {
  if (!(S.espPlayers.v || S.espMonsters.v || S.espTraces.v)) return;
  // Overlay ESP needs ImGui/world draw — flag only until GST UI host is wired
  if (!STATE._espNote) {
    STATE._espNote = true;
    log("ESP flags on — world markers after player/monster enumerators are hooked");
  }
}

/* ── Menu UI (ImGui-style host — same bridge pattern as AR) ─── */

function drawMovement(ui) {
  ui.textColored([0.4, 0.9, 1, 1], "MOVEMENT");
  ui.separator();
  ui.checkbox("Platforms", S.platforms);
  ui.checkbox("Trigger Fly (hold trigger / Y / face buttons)", S.triggerFly);
  ui.checkbox("Fly hold lock (no button needed while on)", S.flyHoldAny);
  ui.checkbox("Joystick Fly", S.joystickFly);
  ui.checkbox("Noclip Fly", S.noclipFly);
  ui.checkbox("Noclip", S.noclip);
  ui.checkbox("Noclip through map props", S.propNoclip, "disable colliders / prop collision");
  ui.checkbox("Super Jump", S.superJump);
  ui.checkbox("Size Changer", S.sizeChanger);
  if (S.sizeChanger.v) ui.sliderFloat("Size scale", S.sizeScale, 0.2, 8, 1);
  ui.checkbox("Mirror / 3rd person cam", S.mirrorCam);

  ui.checkbox("Speed Boost", S.speedBoost);
  if (S.speedBoost.v) ui.sliderFloat("Speed Mult", S.speedMult, 1, 8, 1);
  ui.checkbox("Long Arms", S.longArms);
  if (S.longArms.v) ui.sliderFloat("Arm Scale", S.armScale, 1, 8, 1);
  ui.sliderFloat("Fly Speed", S.flySpeed, 1, 30, 1);
  ui.sliderInt("Jump Mult", S.jumpMult, 2, 20);
}


function drawMonstersTab(ui) {
  ui.textColored([1, 0.5, 0.35, 1], "MONSTERS");
  ui.textDisabled("Scan → select → spawn gun / list spawn");
  ui.separator();
  if (ui.button("Scan Monsters (fast)")) {
    ui.notify(scanMonsters(), 5);
  }
  ui.sameLine();
  if (ui.button("Rescan All")) {
    discover();
    ui.notify(scanMonsters(), 5);
  }
  ui.sameLine();
  if (ui.button("Stop Scan")) {
    ui.notify(stopScan(), 3);
  }
  if (STATE.scanning) ui.textColored([1, 0.7, 0.3, 1], "Scanning...");

  const list = monsterCatalog();
  ui.textColored([0.5, 1, 0.7, 1], "Found: " + list.length);
  if (S.spawnSel.v >= list.length) S.spawnSel.v = 0;
  ui.listBox("##monsters", S.spawnSel, list, 10);
  ui.text("Selected: " + (list[S.spawnSel.v] || "-"));
  ui.separator();
  ui.checkbox("Spawn Monster Gun (blue thick laser)", S.spawnGun);
  ui.sliderFloat("Laser thickness", S.laserThick, 0.02, 0.2, 3);
  if (ui.button("Spawn Selected Here")) {
    try {
      const tr = headTransform();
      const pos = tr ? getPos(tr) : { x: 0, y: 0, z: 0 };
      const name = list[S.spawnSel.v];
      spawnMonsterAt(name, pos);
      ui.notify("spawn " + name);
    } catch (e) {
      ui.notify("spawn failed");
    }
  }
  ui.checkbox("Freeze ALL Monsters", S.freezeMonsters);
  if (ui.button("Unfreeze Monsters")) ui.notify(unfreezeMonsters(), 4);
  if (ui.button("TP Monsters To You")) ui.notify(tpMonstersToMe(), 4);
  if (ui.button("TP Me To Nearest Monster")) ui.notify(tpMeToNearestMonster(), 4);
  ui.separator();
  if (ui.collapsingHeader("Prefabs (AR list + scan)", false)) {
    const plist = prefabCatalog();
    if (S.prefabSel.v >= plist.length) S.prefabSel.v = 0;
    ui.listBox("##prefabs", S.prefabSel, plist, 6);
    ui.checkbox("Prefab Gun", S.prefabGun);
  }
}

function drawEventsTab(ui) {
  ui.textColored([1, 0.75, 0.3, 1], "EVENTS");
  ui.textDisabled("Scan → select → start real game event");
  ui.separator();
  if (ui.button("Scan Events (fast)")) {
    ui.notify(scanEvents(), 6);
  }
  ui.sameLine();
  if (ui.button("Rescan All##ev")) {
    discover();
    ui.notify(scanEvents(), 6);
  }
  ui.sameLine();
  if (ui.button("Stop Scan##ev")) {
    ui.notify(stopScan(), 3);
  }
  if (STATE.scanning) ui.textColored([1, 0.7, 0.3, 1], "Scanning...");

  const evs = eventCatalog();
  ui.textColored([0.5, 1, 0.7, 1], "Found: " + evs.length);
  if (S.eventSel.v >= evs.length) S.eventSel.v = 0;
  ui.listBox("##events", S.eventSel, evs, 12);
  ui.text("Selected: " + (evs[S.eventSel.v] || "-"));
  if (ui.button("Start Selected Event")) {
    ui.notify(startSelectedEvent(), 6);
  }
  if (ui.button("Summon Wave")) {
    ui.notify(summonWave(), 5);
  }
  ui.textDisabled("Best results in a match. List = Class.Method from game.");
}


function drawSpawning(ui) {
  ui.textDisabled("Moved to Monsters tab + Prefabs section there.");
  drawMonstersTab(ui);
}

function drawServer(ui) {
  ui.textColored([0.5, 1, 0.6, 1], "SERVER");
  ui.separator();
  if (ui.button("Set Server Leader (me)")) {
    const ok = trySetMasterClient();
    ui.notify(ok ? "Tried SetMasterClient" : "Photon master API not found yet");
  }
  if (ui.button("TP All To Me")) {
    log("tp all — needs player enum");
    ui.notify("TP all queued (needs player list)");
  }
  ui.checkbox("Orbit All Around You", S.orbitAll);
  if (S.orbitAll.v) {
    ui.sliderFloat("Orbit radius", S.orbitRadius, 1, 12, 1);
    ui.sliderFloat("Orbit speed", S.orbitSpeed, 0.2, 5, 1);
    ui.sliderFloat("Orbit height", S.orbitHeight, 0, 5, 1);
  }
  ui.separator();
  ui.textDisabled("TP to player — list fills when network players are discovered");
  const players = allPlayers();
  if (!players.length) ui.textDisabled("No players enumerated yet");
}


function eventCatalog() {
  // Prefer full Class.Method list from scan
  if (STATE.eventMethods && STATE.eventMethods.length) return STATE.eventMethods.slice(0, 120);
  if (STATE.knownEvents && STATE.knownEvents.length) {
    return STATE.knownEvents.map((n) => n + " (class — rescan for methods)");
  }
  return [
    "(no events yet — press Scan Events)",
    "RoundStart",
    "RoundEnd",
    "MonsterWave",
    "BossEvent",
    "LobbyStart",
    "GameStart",
  ];
}

function scanEvents() {
  const t0 = Date.now();
  try { discover(); } catch (e) {}
  const n = (STATE.eventMethods && STATE.eventMethods.length) || 0;
  const c = (STATE.knownEvents && STATE.knownEvents.length) || 0;
  const ms = Date.now() - t0;
  return n ? ("found " + n + " event methods (" + ms + "ms)") : (c ? ("found " + c + " event classes (" + ms + "ms)") : "nothing found — join a match and scan again");
}

function startSelectedEvent() {
  const list = eventCatalog();
  const name = list[Math.max(0, Math.min(list.length - 1, S.eventSel.v))];
  if (!name || name[0] === "(") return "scan events first";
  try {
    const img = asmImage("Assembly-CSharp");
    if (!img) return "no Assembly-CSharp";
    // Format: Class.Method or Class.Method(n)
    let clsName = name;
    let methName = null;
    const dot = name.indexOf(".");
    if (dot > 0) {
      clsName = name.slice(0, dot);
      methName = name.slice(dot + 1).replace(/\(\d*\)$/, "");
    }
    let hit = false;
    if (methName) {
      try {
        const c = img.tryClass(clsName) || findClass(clsName);
        if (c) {
          const m = c.tryMethod ? c.tryMethod(methName) : null;
          if (m && m.parameterCount === 0) {
            m.invoke();
            hit = true;
            log("event invoke " + clsName + "." + methName);
          } else if (m) {
            // try zeros for simple args
            try { m.invoke(0); hit = true; } catch (e) {
              try { m.invoke(null); hit = true; } catch (e2) {}
            }
          }
        }
      } catch (e) {}
    }
    if (!hit) {
      // fallback fuzzy
      img.classes.forEach((c) => {
        if (hit) return;
        if (clsName && c.name !== clsName && c.name.indexOf(clsName) < 0) return;
        try {
          c.methods.forEach((m) => {
            if (hit) return;
            if (methName && m.name !== methName) return;
            if (!/start|begin|trigger|raise|spawn|launch|activate/i.test(m.name)) return;
            try {
              if (m.parameterCount === 0) { m.invoke(); hit = true; log("event " + c.name + "." + m.name); }
            } catch (e) {}
          });
        } catch (e) {}
      });
    }
    return hit ? ("started " + name) : ("could not invoke " + name);
  } catch (e) {
    return "event failed: " + e;
  }
}

function drawOverpowered(ui) {
  ui.textColored([1, 0.35, 0.35, 1], "OVERPOWERED");
  ui.separator();
  ui.checkbox("GOD MODE (never die)", S.godmode, "keeps health maxed / blocks local death paths");
  ui.checkbox("Anti-Ban", S.antiBan, "blocks local kick/ban RPCs when possible");
  if (S.antiBan.v) installAntiBan();
  ui.checkbox("INVIS", S.invis, "hide your body / name when possible");
  ui.checkbox("Freeze ALL Monsters (everyone sees frozen)", S.freezeMonsters, "zeros monster movement for the room when objects are found");
  if (ui.button("Unfreeze Monsters")) {
    ui.notify(unfreezeMonsters(), 4);
  }
  ui.checkbox("Fling All", S.flingAll, "yeet players + monsters");
  if (ui.button("Summon Wave")) {
    ui.notify(summonWave(), 5);
  }
  if (ui.button("TP Monsters To You")) {
    ui.notify(tpMonstersToMe(), 4);
  }
  if (ui.button("TP Me To Nearest Monster")) {
    ui.notify(tpMeToNearestMonster(), 4);
  }

  ui.separator();
  ui.checkbox("Fling Gun", S.flingGun);
  ui.checkbox("Pull Gun", S.pullGun, "pull player toward you");
  ui.checkbox("Black Screen Gun", S.blackScreenGun, "try black-out target view");
  ui.checkbox("Give Godmode Gun", S.giveGodGun, "aim player → grant them godmode flag");
  ui.checkbox("Kill Gun / Kill Players", S.killGun, "damage/kill aimed or listed players");
  ui.checkbox("Kill All Players pulse", S.killPlayer);
  ui.checkbox("Zero Gravity Gun", S.zeroGGun);
  ui.checkbox("Fly Gun (give them trigger-fly)", S.flyGun);
  ui.checkbox("Crash Gun", S.crashGun);
  ui.checkbox("Crash All", S.crashAll);
  ui.checkbox("TP All Laser Gun", S.tpAllGun, "trigger → teleport every player to where you aim");
  ui.separator();
  ui.textColored([0.8, 0.9, 1, 1], "SPOOF ID");
  ui.checkbox("Spoof ID / Name", S.spoofId);
  ui.inputText("Spoof name##sid", S.spoofIdText, "mestro_ac");
  ui.textDisabled("Events moved to the Events tab.");
}

function drawVisual(ui) {
  ui.textColored([0.6, 1, 0.75, 1], "VISUAL");
  ui.textDisabled("ESP + distance");
  ui.separator();
  ui.checkbox("ESP Players", S.espPlayers);
  ui.checkbox("ESP Monsters", S.espMonsters);
  ui.checkbox("ESP Traces", S.espTraces);
  ui.checkbox("Monster distance text", S.monsterEspDist);
  ui.separator();
  ui.checkbox("Stealth menu (less console spam)", S.stealthMenu);
  ui.textDisabled("Stealth = quieter logs. Nothing is fully undetectable on Quest.");
  ui.textDisabled("Markers improve after Rescan Classes finds monster types.");
}


function sbFindGstPackage() {
  if (STATE.sbPkg) return STATE.sbPkg;
  const found = [];
  try {
    Java.perform(function () {
      const File = Java.use("java.io.File");
      const root = File.$new("/sdcard/Android/data");
      const list = root.listFiles();
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        const n = String(list[i].getName()).toLowerCase();
        if (n.indexOf("gold") >= 0 || n.indexOf("spook") >= 0 || n.indexOf("gst") >= 0 || n.indexOf("boolon") >= 0) {
          found.push(String(list[i].getName()));
        }
      }
    });
  } catch (e) {}
  STATE.sbPkg = found[0] || null;
  if (found.length) log("Soundbored package candidates: " + found.join(", "));
  return STATE.sbPkg;
}

function sbDataDirs() {
  const dirs = [];
  const pkg = sbFindGstPackage();
  if (pkg) {
    dirs.push("/sdcard/Android/data/" + pkg + "/files/Soundbored");
    dirs.push("/sdcard/Android/data/" + pkg + "/Soundbored");
    dirs.push("/storage/emulated/0/Android/data/" + pkg + "/files/Soundbored");
  }
  dirs.push("/sdcard/Download/Soundbored");
  dirs.push("/sdcard/Music/Soundbored");
  dirs.push("/sdcard/Soundbored");
  return dirs;
}

function sbMakeSoundboredFolder() {
  const made = [];
  try {
    Java.perform(function () {
      const File = Java.use("java.io.File");
      const pkg = sbFindGstPackage();
      const targets = [];
      if (pkg) {
        targets.push("/sdcard/Android/data/" + pkg + "/files/Soundbored");
        targets.push("/sdcard/Android/data/" + pkg + "/files");
      }
      targets.push("/sdcard/Download/Soundbored");
      for (const d of targets) {
        try {
          const f = File.$new(d);
          if (!f.exists()) f.mkdirs();
          if (f.exists()) made.push(d);
        } catch (e) {}
      }
    });
  } catch (e) {
    return "mkdir failed: " + e;
  }
  sbScan();
  if (!made.length) return "could not create — use Add files or make /sdcard/Download/Soundbored manually";
  return "Soundbored ready: " + made[0];
}

function sbOpenFilePicker() {
  // Best-effort ACTION_OPEN_DOCUMENT / GET_CONTENT — may need user in 2D passthrough
  try {
    Java.perform(function () {
      const Intent = Java.use("android.content.Intent");
      const ActivityThread = Java.use("android.app.ActivityThread");
      const ctx = ActivityThread.currentApplication().getApplicationContext();
      const intent = Intent.$new("android.intent.action.GET_CONTENT");
      intent.setType("audio/*");
      intent.addCategory("android.intent.category.OPENABLE");
      intent.addFlags(0x10000000); // FLAG_ACTIVITY_NEW_TASK
      // also allow video containers used as audio
      try {
        const extra = Intent.$new();
        // EXTRA_ALLOW_MULTIPLE
        intent.putExtra("android.intent.extra.ALLOW_MULTIPLE", true);
      } catch (e) {}
      ctx.startActivity(intent);
      STATE._pickerNote = "picker opened — after pick, Refresh list (or copy file into Soundbored folder)";
    });
    return STATE._pickerNote || "file picker opened";
  } catch (e) {
    return "picker failed — copy songs into Soundbored folder instead: " + e;
  }
}

function sbScan() {
  SB.files = [];
  SB.folders = sbDataDirs();
  const exts = [".wav", ".mp3", ".mp4", ".mov", ".m4a", ".ogg", ".aac", ".flac"];
  try {
    Java.perform(function () {
      const File = Java.use("java.io.File");
      for (const d of SB.folders) {
        try {
          const dir = File.$new(d);
          if (!dir.exists()) continue;
          const arr = dir.listFiles();
          if (!arr) continue;
          for (let i = 0; i < arr.length; i++) {
            const f = arr[i];
            if (f.isDirectory()) continue;
            const name = String(f.getName());
            const low = name.toLowerCase();
            if (!exts.some((e) => low.endsWith(e))) continue;
            SB.files.push({ name: name, path: String(f.getAbsolutePath()) });
          }
        } catch (e) {}
      }
    });
  } catch (e) {
    SB.status = "scan failed";
    errOnce("sbScan", e);
  }
  SB.at = Date.now();
  SB.status = SB.files.length ? SB.files.length + " sound(s) in Soundbored" : "empty — Make Soundbored folder, then drop files in it";
  return SB.status;
}

function sbPlay(i) {
  const f = SB.files[i];
  if (!f) return "pick a sound";
  const level = Math.max(1, Math.min(10, +S.sbVolLevel.v || 10));
  // Map 1-10 → gain. Level 10 stacks multiple MediaPlayers for "super loud"
  const base = level / 10;
  const copies = level >= 10 ? 3 : level >= 8 ? 2 : 1;
  try {
    Java.perform(function () {
      const MediaPlayer = Java.use("android.media.MediaPlayer");
      if (STATE._mps) {
        for (const mp of STATE._mps) {
          try { mp.stop(); mp.release(); } catch (e) {}
        }
      }
      STATE._mps = [];
      for (let c = 0; c < copies; c++) {
        try {
          const mp = MediaPlayer.$new();
          mp.setDataSource(f.path);
          mp.setVolume(base, base);
          try { mp.setLooping(false); } catch (e) {}
          // STREAM_MUSIC = 3 for far/room speakers; also try voice
          try { mp.setAudioStreamType(3); } catch (e) {}
          mp.prepare();
          mp.start();
          STATE._mps.push(mp);
        } catch (e) {}
      }
      // force voice TX so multiplayer can hear when game routes mic
      try {
        const asm = Il2Cpp.domain.tryAssembly("Assembly-CSharp")?.image;
        if (asm) {
          const CVR = asm.tryClass("CustomVoiceRecorder") || asm.tryClass("PhotonVoiceRecorder") || asm.tryClass("Recorder");
          if (CVR) {
            let inst = null;
            try { inst = CVR.method("get_Instance").invoke(); } catch (e) {}
            if (inst) {
              try { inst.method("set_TransmitEnabled").invoke(true); } catch (e) {}
              try { inst.method("set_IsTransmitting").invoke(true); } catch (e) {}
            }
          }
        }
      } catch (e) {}
    });
    log("Soundbored PLAY " + f.name + " lvl=" + level + " x" + copies + " (everyone/far)");
    return "playing " + f.name + " @ " + level + "/10";
  } catch (e) {
    errOnce("sbPlay", e);
    return "play failed: " + e;
  }
}

function sbStop() {
  try {
    Java.perform(function () {
      if (STATE._mps) {
        for (const mp of STATE._mps) {
          try { mp.stop(); mp.release(); } catch (e) {}
        }
        STATE._mps = [];
      }
      if (STATE._mp) {
        try { STATE._mp.stop(); STATE._mp.release(); } catch (e) {}
        STATE._mp = null;
      }
    });
  } catch (e) {}
}

function sbMakeFolders() {
  return sbMakeSoundboredFolder();
}


function drawSoundboard(ui) {
  ui.textColored([0.4, 0.95, 1, 1], "SOUNDBOARD");
  ui.textDisabled("Everyone hears · far away · WAV MP3 MP4 MOV");
  ui.separator();

  if (ui.button("Make Soundbored folder")) {
    ui.notify(sbMakeSoundboredFolder(), 6);
  }
  ui.textDisabled("Path: Android/data/<GST package>/files/Soundbored");
  ui.textDisabled("If that fails, folder is also made under /sdcard/Download/Soundbored");

  if (ui.button("Add files (open picker)")) {
    ui.notify(sbOpenFilePicker(), 6);
  }
  ui.textDisabled("Picker adds paths into the list when the OS allows it.");

  ui.separator();
  if (!SB.files.length || (S.sbAuto.v && Date.now() - SB.at > 4000)) sbScan();
  if (!SB.files.length) {
    ui.textDisabled(SB.status || "no sounds yet");
  } else {
    const names = SB.files.map((f) => f.name);
    if (S.sbSel.v >= names.length) S.sbSel.v = 0;
    ui.listBox("##sblist", S.sbSel, names, 8);
    ui.text("Selected: " + (names[S.sbSel.v] || "-"));
  }
  if (ui.button("Play (room hears)")) {
    ui.notify(sbPlay(S.sbSel.v), 4);
  }
  ui.sameLine();
  if (ui.button("Stop")) { sbStop(); ui.notify("stopped"); }
  ui.sameLine();
  if (ui.button("Refresh")) ui.notify(sbScan(), 4);

  ui.separator();
  ui.textColored([1, 0.85, 0.3, 1], "VOLUME 1-10 (10 = SUPER LOUD)");
  ui.sliderInt("Soundbored Volume", S.sbVolLevel, 1, 10);
  S.sbVol.v = Math.min(1, (S.sbVolLevel.v || 10) / 10);
  // for level 10 we stack extra gain in sbPlay
  ui.checkbox("Others hear (everyone / far)", S.sbOthers);
  S.sbOthers.v = true; // force default on
  ui.checkbox("Hear myself", S.sbSelf);
  ui.text(SB.status || "");
  if (STATE.sbPkg) ui.textDisabled("package: " + STATE.sbPkg);
}

function drawHome(ui) {
  ui.textColored([0.35, 0.95, 0.55, 1], "mestro_ac spooky terror menu");
  ui.textDisabled("Gold's Spooky Terror · v" + MENU_VERSION);
  ui.textColored([0.3, 0.9, 1, 1], "ONLINE: " + (LIVE.online > 0 ? LIVE.online : "?"));
  if (LIVE.announcement) ui.textColored([1, 0.92, 0.2, 1], "ANN: " + String(LIVE.announcement).slice(0, 80));
  ui.separator();
  ui.text("Template: yurshi + astures  ·  Menu: mestro_ac");
  ui.separator();
  ui.checkbox("Gun Pointer", S.gunPointer);
  if (ui.button("Open Discord")) ui.openUrl(DISCORD_URL);
  ui.sameLine();
  if (ui.button("Rescan Classes")) {
    discover();
    ui.notify("scan done — check console");
  }
  ui.separator();
  if (ui.button("PANIC OFF")) {
    ui.notify(panicOff(), 4);
  }
  ui.textDisabled("Turns every mod off immediately");
  ui.separator();
  ui.textDisabled("GST hooks tighten after Rescan + class logs.");
  ui.checkbox("Stealth menu", S.stealthMenu, "reduce log noise — not fully undetectable");
}

function drawMenu(ui) {
  if (!ui.begin(MENU_TITLE)) {
    ui.end();
    return;
  }
  try { liveHeartbeat(); } catch (e) {}
  if (drawKeyGate(ui)) {
    ui.end();
    return;
  }
  if (LIVE.lockdown) {
    ui.textColored([1, 0.3, 0.3, 1], "LOCKDOWN");
    ui.text(LIVE.lockdownMsg || "mods locked by owner");
    if (ui.button("Open Discord##ld")) ui.openUrl(DISCORD_URL);
    ui.end();
    return;
  }
  ui.textColored([0.35, 0.95, 0.55, 1], "LIVE | Online: " + (LIVE.online > 0 ? LIVE.online : "?"));
  if (LIVE.announcement) {
    ui.textColored([1, 0.92, 0.2, 1], "ANN: " + String(LIVE.announcement).slice(0, 100));
  }
  ui.beginTabBar("gsttabs");
  if (ui.tabItem("Home")) drawHome(ui);
  if (ui.tabItem("Movement")) drawMovement(ui);
  if (ui.tabItem("Monsters")) drawMonstersTab(ui);
  if (ui.tabItem("Events")) drawEventsTab(ui);
  if (ui.tabItem("Server")) drawServer(ui);
  if (ui.tabItem("Overpowered")) drawOverpowered(ui);
  if (ui.tabItem("Visual")) drawVisual(ui);
  if (ui.tabItem("Soundboard")) drawSoundboard(ui);
  ui.endTabBar();
  ui.end();
}

/* ── Main tick ──────────────────────────────────────────────── */

function tick() {
  try {
    tickFly();
    tickNoclip();
    tickSuperJump();
    tickPlatforms();
    tickSpeed();
    tickLongArms();
    tickGodmode();
    tickFreezeMonsters();
    tickInvis();
    tickSpoofId();
    tickFlingAll();
    tickSizeChanger();
    tickMirror();
    tickPropNoclip();
    tickSpawnGun();
    tickLaserVisual();
    tickOrbit();
    tickGuns();
    tickCrashAll();
    tickEsp();
  } catch (e) {
    errOnce("tick", e);
  }
}


/* ── Key system + LIVE bot (same Railway as AR) ─────────────── */

const KEYSYS = {
  phase: 0, loadStart: Date.now(), LOAD_MS: 2500,
  menuKey: "", deviceId: "", keyBoundId: "",
  menuUnlocked: false, keyMsg: "", keyMsgBad: false,
  keyEntry: { v: "" }, lastValidateAt: 0, _booted: false
};
const LIVE = {
  online: 0, announcement: "", announcementBy: "",
  lastBeat: 0, BEAT_MS: 8000, lockdown: false, lockdownMsg: ""
};

function keyDataDir() {
  // prefer GST package files if known
  try {
    const pkg = (typeof sbFindGstPackage === "function" && sbFindGstPackage()) || null;
    if (pkg) return "/sdcard/Android/data/" + pkg + "/files";
  } catch (e) {}
  return "/sdcard/Android/data/com.unity3d.player/files";
}
function keyRandomDigits15() {
  let s = String(1 + Math.floor(Math.random() * 9));
  while (s.length < 15) s += String(Math.floor(Math.random() * 10));
  return s;
}
function keyReadDeviceId() {
  if (KEYSYS.deviceId) return KEYSYS.deviceId;
  try {
    const t = String(File.readAllText(keyDataDir() + "/mestros_device.id") || "").trim();
    if (/^\d{6,32}$/.test(t)) { KEYSYS.deviceId = t; return KEYSYS.deviceId; }
  } catch (e) {}
  KEYSYS.deviceId = keyRandomDigits15();
  try { File.writeAllText(keyDataDir() + "/mestros_device.id", KEYSYS.deviceId + "\n"); } catch (e) {
    try { const f = new File(keyDataDir() + "/mestros_device.id", "w"); f.write(KEYSYS.deviceId + "\n"); f.flush(); f.close(); } catch (e2) {}
  }
  return KEYSYS.deviceId;
}
function keyReadSavedKey() {
  try {
    const t = File.readAllText(keyDataDir() + "/mestros_menu.key");
    if (!t) return;
    const lines = String(t).split(/\r?\n/);
    if (lines[0]) KEYSYS.menuKey = lines[0].trim();
  } catch (e) {}
}
function keyWriteSavedKey() {
  try { File.writeAllText(keyDataDir() + "/mestros_menu.key", KEYSYS.menuKey + "\n"); }
  catch (e) { try { const f = new File(keyDataDir() + "/mestros_menu.key", "w"); f.write(KEYSYS.menuKey + "\n"); f.flush(); f.close(); } catch (e2) {} }
}
function keySetClipboard(text) {
  const s = String(text || "");
  try {
    Java.perform(() => {
      const ctx = Java.use("android.app.ActivityThread").currentApplication().getApplicationContext();
      const cm = Java.cast(ctx.getSystemService("clipboard"), Java.use("android.content.ClipboardManager"));
      const clip = Java.use("android.content.ClipData").newPlainText("mestro", s);
      cm.setPrimaryClip(clip);
    });
    return true;
  } catch (e) {}
  return false;
}
function keyGetClipboard() {
  try {
    let out = "";
    Java.perform(() => {
      const ctx = Java.use("android.app.ActivityThread").currentApplication().getApplicationContext();
      const cm = Java.cast(ctx.getSystemService("clipboard"), Java.use("android.content.ClipboardManager"));
      const clip = cm.getPrimaryClip();
      if (clip && clip.getItemCount() > 0) {
        const item = clip.getItemAt(0);
        const tx = item.coerceToText(ctx);
        if (tx) out = String(tx);
      }
    });
    return out;
  } catch (e) {}
  return "";
}
function keyServerCall(path, body) {
  let result = null;
  try {
    Java.perform(function () {
      try {
        const URL = Java.use("java.net.URL");
        const conn = Java.cast(URL.$new(String(SERVER_URL) + String(path)).openConnection(), Java.use("java.net.HttpURLConnection"));
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(4000);
        conn.setReadTimeout(4000);
        conn.setRequestProperty("Content-Type", "application/json");
        const bytes = Java.use("java.lang.String").$new(JSON.stringify(body || {})).getBytes("UTF-8");
        conn.getOutputStream().write(bytes);
        const code = conn.getResponseCode();
        const stream = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        const Scanner = Java.use("java.util.Scanner");
        const sc = Scanner.$new(stream).useDelimiter("\\A");
        const raw = sc.hasNext() ? String(sc.next()) : "{}";
        result = JSON.parse(raw);
      } catch (e) {
        KEYSYS._lastNetErr = String(e);
      }
    });
  } catch (e) {
    KEYSYS._lastNetErr = String(e);
  }
  return result;
}
function keyTryActivate() {
  const typed = String(KEYSYS.keyEntry.v || "").trim();
  if (!typed) { KEYSYS.keyMsg = "Type key from Discord"; KEYSYS.keyMsgBad = true; return; }
  const r = keyServerCall("/activate", { key: typed, device_id: keyReadDeviceId(), target: "gst", version: MENU_VERSION });
  if (!r) { KEYSYS.keyMsg = "Server unreachable — bot offline?"; KEYSYS.keyMsgBad = true; return; }
  if (!r.ok) { KEYSYS.keyMsg = r.msg || "Key rejected"; KEYSYS.keyMsgBad = true; return; }
  KEYSYS.menuKey = typed; keyWriteSavedKey(); KEYSYS.phase = 2;
  KEYSYS.keyMsg = "Key saved. Link device in Discord, then press Linked"; KEYSYS.keyMsgBad = false;
}
function keyLinkedCheck() {
  if (!KEYSYS.menuKey) { KEYSYS.keyMsg = "Enter key first"; KEYSYS.keyMsgBad = true; return; }
  const r = keyServerCall("/validate", { key: KEYSYS.menuKey, device_id: keyReadDeviceId(), target: "gst", version: MENU_VERSION });
  KEYSYS.lastValidateAt = Date.now();
  if (!r) { KEYSYS.keyMsg = "Server unreachable"; KEYSYS.keyMsgBad = true; return; }
  if (r.ok) {
    KEYSYS.menuUnlocked = true; KEYSYS.phase = 3;
    KEYSYS.keyMsg = "linked successful"; KEYSYS.keyMsgBad = false;
    if (typeof r.online === "number") LIVE.online = r.online;
    if (r.announcement) LIVE.announcement = String(r.announcement);
    return;
  }
  KEYSYS.keyMsg = "please link your device in the buyer dashboard (or /link), then try again";
  KEYSYS.keyMsgBad = true;
}
function keyCheckServer() {
  if (!KEYSYS.menuKey) return;
  const r = keyServerCall("/validate", { key: KEYSYS.menuKey, device_id: keyReadDeviceId(), target: "gst", version: MENU_VERSION });
  KEYSYS.lastValidateAt = Date.now();
  if (r && r.ok) {
    KEYSYS.menuUnlocked = true; KEYSYS.phase = 3;
    if (typeof r.online === "number") LIVE.online = r.online;
    if (r.announcement) LIVE.announcement = String(r.announcement);
    if (r.lockdown) { LIVE.lockdown = true; LIVE.lockdownMsg = r.msg || "locked"; }
  }
}
function liveHeartbeat() {
  if (KEY_BUILD && !KEYSYS.menuUnlocked) return;
  if (Date.now() - LIVE.lastBeat < LIVE.BEAT_MS) return;
  LIVE.lastBeat = Date.now();
  const r = keyServerCall("/heartbeat", {
    key: KEYSYS.menuKey || "nokey",
    device_id: keyReadDeviceId(),
    menu: MENU_TITLE,
    target: "gst",
    version: MENU_VERSION
  });
  if (!r) return;
  if (typeof r.online === "number") LIVE.online = r.online;
  if (r.announcement != null) LIVE.announcement = String(r.announcement);
  if (r.lockdown) { LIVE.lockdown = true; LIVE.lockdownMsg = r.msg || "locked"; }
  else LIVE.lockdown = false;
}
function keyBootOnce() {
  if (KEYSYS._booted) return;
  KEYSYS._booted = true;
  if (!KEY_BUILD) {
    KEYSYS.menuUnlocked = true;
    KEYSYS.phase = 3;
    return;
  }
  KEYSYS.menuUnlocked = false;
  KEYSYS.phase = 0;
  KEYSYS.loadStart = Date.now();
  keyReadSavedKey();
  keyReadDeviceId();
}
function drawKeyGate(ui) {
  keyBootOnce();
  if (!KEY_BUILD) return false;
  const green = [0.2, 1.0, 0.35, 1], accent = [0.55, 0.85, 1, 1], bad = [1, 0.4, 0.4, 1], good = [0.35, 0.95, 0.5, 1];
  if (KEYSYS.phase === 0) {
    const tt = Date.now() - KEYSYS.loadStart, p = Math.min(1, tt / KEYSYS.LOAD_MS);
    ui.textColored(accent, MENU_TITLE);
    ui.text("Loading...");
    if (ui.progressBar) ui.progressBar(p);
    if (tt >= KEYSYS.LOAD_MS) KEYSYS.phase = 1;
    return true;
  }
  if (KEYSYS.menuUnlocked || KEYSYS.phase === 3) {
    KEYSYS.phase = 3; KEYSYS.menuUnlocked = true;
    if (Date.now() - KEYSYS.lastValidateAt > 60000 && KEYSYS.menuKey) keyCheckServer();
    return false;
  }
  const dev = keyReadDeviceId();
  if (KEYSYS.phase === 1) {
    ui.textColored(accent, "DEVICE LINK");
    ui.separator();
    ui.textColored(green, "DEVICE ID");
    ui.textColored(green, dev);
    if (ui.button("Copy Device ID")) {
      KEYSYS.keyMsg = keySetClipboard(dev) ? "copied" : ("write down: " + dev);
      KEYSYS.keyMsgBad = !keySetClipboard(dev);
    }
    if (ui.button("Open Discord")) ui.openUrl(DISCORD_URL);
    ui.text("1) Buyer dashboard → Link Device  2) /link  3) press Linked");
    if (ui.button("Linked")) {
      KEYSYS.phase = 2;
      KEYSYS.keyMsg = "Paste key from /key (pick GST / game)";
      KEYSYS.keyMsgBad = false;
    }
    if (KEYSYS.keyMsg) ui.textColored(KEYSYS.keyMsgBad ? bad : good, KEYSYS.keyMsg);
    return true;
  }
  // phase 2 key
  ui.textColored(accent, "ENTER KEY");
  ui.text("Device: " + dev);
  if (ui.button("Copy Device ID##k")) keySetClipboard(dev);
  ui.inputText("Key", KEYSYS.keyEntry);
  if (ui.button("Paste Key")) {
    const c = String(keyGetClipboard() || "").trim();
    if (c) { KEYSYS.keyEntry.v = c; KEYSYS.keyMsg = "pasted"; KEYSYS.keyMsgBad = false; }
  }
  if (ui.button("Activate Key")) {
    keyTryActivate();
    if (KEYSYS.menuKey) keyLinkedCheck();
  }
  if (ui.button("Device Linked (check)")) keyLinkedCheck();
  if (ui.button("Back")) KEYSYS.phase = 1;
  if (KEYSYS.keyMsg) ui.textColored(KEYSYS.keyMsgBad ? bad : good, KEYSYS.keyMsg);
  return true;
}


/* ── Bootstrap ──────────────────────────────────────────────── */

function boot() {
  log(MENU_TITLE + " " + MENU_VERSION + " booting");
  discover();
  STATE.ready = true;

  // If AR-style UI host exists on global, hook it
  if (globalThis.__AR_UI_HOST__) {
    log("UI host found");
  }

  // Poll tick
  setInterval(tick, 50);

  // Expose draw for external ImGui pump (same as AR bridge hosts)
  globalThis.__MESTRO_GST_DRAW__ = drawMenu;
  globalThis.__MESTRO_GST_STATE__ = S;
  log("ready — Home / Movement / Monsters / Events / Server / Overpowered / Visual / Soundboard");
  log("Enable mods in menu. Send class-hit lines for tighter spawn/player hooks.");
}

rpc.exports = {
  scan: function () {
    discover();
    return "ok";
  },
};

if (typeof Il2Cpp !== "undefined") {
  Il2Cpp.perform(boot);
} else {
  // wait for bridge
  const iv = setInterval(function () {
    if (typeof Il2Cpp !== "undefined") {
      clearInterval(iv);
      Il2Cpp.perform(boot);
    }
  }, 200);
}
