const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

async function migrarRolesTecnico() {
    const snap = await db.collection("usuarios")
        .where("rol", "==", "técnico")
        .get();

    if (snap.empty) {
        console.log("No hay usuarios con rol antiguo.");
        return;
    }

    const batch = db.batch();
    snap.docs.forEach((doc) => {
        batch.update(doc.ref, { rol: "tecnico" });
    });

    await batch.commit();
    console.log(`Migrados: ${snap.size} documentos`);
}

migrarRolesTecnico().catch((error) => {
    console.error("Error al migrar roles:", error);
    process.exitCode = 1;
});
