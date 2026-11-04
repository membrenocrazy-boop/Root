"use strict";

Il2Cpp.perform(() => {
    console.log("[AC SCAN] Looking for Anti-Cheat classes...");
    
    try {
        const asm = Il2Cpp.domain.assembly("Assembly-CSharp").image;
        const classes = asm.classes;
        let hits = 0;
        
        for (let i = 0; i < classes.length; i++) {
            const c = classes[i];
            const n = c.name.toLowerCase();
            if (n.includes("cheat") || n.includes("kick") || n.includes("ban") || n.includes("guard") || n.includes("security") || n.includes("punish")) {
                console.log("[AC SCAN] Found: " + c.name);
                hits++;
            }
        }
        
        if (hits === 0) {
            console.log("[AC SCAN] No obvious Anti-Cheat classes found in Assembly-CSharp.");
        }
    } catch (e) {
        console.log("[AC SCAN] Error: " + e);
    }
    console.log("[AC SCAN] Done.");
});
