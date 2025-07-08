document.addEventListener('DOMContentLoaded', () => {
    const mainHeader = document.getElementById('main-header');
    const stickyHeader = document.getElementById('sticky-header');

    if (!mainHeader || !stickyHeader) {
        console.error('Required header elements not found. Sticky header will not function.');
        return;
    }

    // We want the sticky header to appear once the main header is completely out of view.
    const triggerPoint = mainHeader.offsetTop + mainHeader.offsetHeight;

    window.addEventListener('scroll', () => {
        if (window.scrollY > triggerPoint) {
            stickyHeader.classList.add('visible');
        } else {
            stickyHeader.classList.remove('visible');
        }
    }, { passive: true }); // Use passive listener for better scroll performance
});
