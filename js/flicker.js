(function() {
    const FLICKER_SPEED = 80;

    function flicker() {
        const bgs = document.querySelectorAll('.landing .flicker-bg');
        bgs.forEach(bg => {
            const opacity = 0.85 + Math.random() * 0.15;
            const brightness = 0.9 + Math.random() * 0.2;
            bg.style.opacity = opacity;
            bg.style.filter = `brightness(${brightness})`;
        });
    }

    setInterval(flicker, FLICKER_SPEED);
})();
