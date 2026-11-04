Il2Cpp.perform(() => {
    console.log("[GST SCAN] Looking for Player and Monster classes...");
    
    // Check standard Unity assemblies
    const imgs = ["Assembly-CSharp", "Assembly-CSharp-firstpass"];
    
    for (const imgName of imgs) {
        try {
            const img = Il2Cpp.domain.assembly(imgName).image;
            const classes = img.classes;
            for (let i = 0; i < classes.length; i++) {
                const c = classes[i];
                const n = c.name.toLowerCase();
                if (n.includes("player") || n.includes("monster") || n.includes("enemy") || n.includes("health") || n.includes("rig")) {
                    console.log("[GST SCAN] Found: " + c.name);
                }
            }
        } catch (e) {
            console.log("[GST SCAN] Could not find " + imgName);
        }
    }
    console.log("[GST SCAN] Done. Send me the output.");
});
