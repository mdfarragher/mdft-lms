// Append ?next=<current path> to any login link on the page
(function () {
    var next = encodeURIComponent(window.location.pathname + window.location.search);
    ["nav-login-link", "lesson-signin-btn"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.href = "/login?next=" + next;
    });
})();

// Lab lesson image lightbox
document.addEventListener('DOMContentLoaded', function () {
    var modalEl = document.getElementById('labImageModal');
    if (!modalEl) return;
    var modal = new bootstrap.Modal(modalEl);
    var modalImg = document.getElementById('labImageModalImg');
    document.querySelectorAll('.lab-content img').forEach(function (img) {
        img.addEventListener('click', function () {
            modalImg.src = img.src;
            modalImg.alt = img.alt;
            modal.show();
        });
    });
});
