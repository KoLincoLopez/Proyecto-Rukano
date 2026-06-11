import { auth } from "./Firebase-config.js";


export async function apiFetch(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Debes iniciar sesion para realizar esta accion.");
    }

    const token = await user.getIdToken();
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(url, {
        ...options,
        headers
    });
}
