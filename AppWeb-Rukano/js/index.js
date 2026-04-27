document.addEventListener("DOMContentLoaded", () => {
    const navbar = document.querySelector(".navbar-integrada");

    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });

    if (btnHamburguesa) {
        btnHamburguesa.addEventListener("click", () => {
            // Si la pantalla es menor a 768px, el menú ocupa el 100%, si no, 300px.
            if (window.innerWidth <= 768) {
                sideMenu.style.width = "100%";
            } else {
                sideMenu.style.width = "300px";
            }
            overlay.style.display = "block";
        });
    }
});