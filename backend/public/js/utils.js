function copyAsIframe(button) {
    const data = button.getAttribute('data-url');
    const iframe = `<p><iframe src="${data}" width="100%" height="1000" marginwidth="0" marginheight="0" frameborder="0">` +
        `</iframe></p>`
    navigator.clipboard.writeText(iframe);
    button.classList.toggle('btn-custom-action');
    button.classList.toggle('btn-deactivate');
    setTimeout(function () {
        button.classList.toggle('btn-custom-action');
        button.classList.toggle('btn-deactivate');
    }, 1000);
}


function validateUserDeletion(form) {
    let userEmail = form.userId.getAttribute('data-email');
    if (confirm(`Do you really want to delete the user (${userEmail})?`)) {
        let userId = form.userId.value;
        $.ajax({
            url: '/user/delete',
            type: 'POST',
            contentType: 'application/x-www-form-urlencoded',
            data: {userId},
            success:(response) => {
                $(`#user-row-${userId}`)
                    .children('td, th')
                    .animate({ padding: 0 })
                    .wrapInner('<div />')
                    .children()
                    .slideUp(function() {
                        $(this).closest('tr').remove();
                    });
            },
            error: (err) => {
                alert(err.responseText);
            }
        });
    }
}


function validateToggleUserActivation(form) {
    let userId = form.userId.value;
    $.ajax({
        url: '/user/toggle/activation',
        type: 'POST',
        contentType: 'application/x-www-form-urlencoded',
        data: {userId},
        success: (response) => {
            let activationToggleButton = form.children[1];
            if (activationToggleButton.getAttribute('title') == 'Deactivate') {
                activationToggleButton.setAttribute('title', 'Activate');
            } else {
                activationToggleButton.setAttribute('title', 'Deactivate');
            }
            activationToggleButton.classList.toggle('btn-custom-action');
            activationToggleButton.classList.toggle('btn-deactivate');
            form.children[1].children[0].classList.toggle('glyphicon-ok');
            form.children[1].children[0].classList.toggle('glyphicon-remove');
            let activeStatusColumn = document.getElementById(`user-row-${userId}`).cells[3];
            activeStatusColumn.children[0].classList.toggle('glyphicon-remove');
            activeStatusColumn.children[0].classList.toggle('glyphicon-ok');
        },
        error: (err) => {
            alert(err.responseText);
        }
    });
}


function validateRecordDeletion(form) {
    let recordName = form.recordId.getAttribute('data-record-name');
    if (confirm(`Do you really want to delete the record (${recordName})?`)) {
        let recordId = form.recordId.value;
        $.ajax({
            url: '/record/delete',
            type: 'POST',
            contentType: 'application/x-www-form-urlencoded',
            data: {recordId},
            success:(response) => {
                let recordRow = $(`#record-row-${recordId}`);
                if (recordRow.siblings().length == 1) {
                    recordRow.html("<td colspan='4'>No Records Found</td>");
                } else {
                    recordRow
                        .children('td, th')
                        .animate({ padding: 0 })
                        .wrapInner('<div />')
                        .children()
                        .slideUp(function() {
                            $(this).closest('tr').remove();
                        });
                }
            },
            error: (err) => {
                alert(err.responseText);
            }
        });
    }
}


function validateUserCreation(form) {
    $.ajax({
        url: '/user/add',
        type: 'POST',
        contentType: 'application/x-www-form-urlencoded',
        data: {
            email: form.email.value,
            username: form.username.value,
            password: form.password.value
        },
        success:(response) => {
            alert(response);
        },
        error: (err) => {
            alert(err.responseText);
        }
    });
}
