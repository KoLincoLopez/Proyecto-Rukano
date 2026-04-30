document.addEventListener('DOMContentLoaded', () => {
    const linksTransicion = document.querySelectorAll('.btn-link, .volver-inicio a');

    linksTransicion.forEach(link => {
        link.addEventListener('click', (evento) => {
            evento.preventDefault();
            
            const destino = link.href;

            const pantalla = document.querySelector('.split-pantalla');
            pantalla.classList.add('animacion-salida');

            setTimeout(() => {
                window.location.href = destino;
            }, 400); 
        });
    });
});