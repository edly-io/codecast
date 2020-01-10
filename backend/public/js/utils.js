function copyAsIframe(e) {
    e.preventDefault();
    const data = e.target.getAttribute('data');
    let iframe = `<p><iframe src="${data}" width="100%" height="1000" marginwidth="0" marginheight="0" frameborder="0">` +
                 `</iframe></p>`
    navigator.clipboard.writeText(iframe);
}
