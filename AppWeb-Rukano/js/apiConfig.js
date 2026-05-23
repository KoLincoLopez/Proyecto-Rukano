(function () {
    const LOCAL_API_URL = "http://127.0.0.1:8000";
    const RENDER_API_URL = "https://rukano-sph.onrender.com";

    function getApiBaseUrl() {
        if (window.RUKANO_API_BASE_URL) {
            return String(window.RUKANO_API_BASE_URL).replace(/\/$/, "");
        }

        const esLocal = (
            window.location.protocol === "file:" ||
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"
        );

        return esLocal ? LOCAL_API_URL : RENDER_API_URL;
    }

    window.RukanoApiConfig = {
        LOCAL_API_URL,
        RENDER_API_URL,
        getApiBaseUrl
    };
})();
