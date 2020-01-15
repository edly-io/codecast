function copyAsIframe(e) {
    e.preventDefault();
    const data = e.target.getAttribute('data');
    let iframe = `<p><iframe src="${data}" width="100%" height="1000" marginwidth="0" marginheight="0" frameborder="0">` +
                 `</iframe></p>`
    navigator.clipboard.writeText(iframe);
    setTimeout(function(){alert(`IFrame link is copied to your clipboard: ${iframe}`)},100);
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
            let activationToggleButton = form.querySelector('button[type="submit"]');
            activationToggleButton.classList.toggle('btn-custom-primary');
            if (activationToggleButton.innerHTML.trim() == 'Activate') {
                activationToggleButton.innerHTML = 'Deactivate';
            } else {
                activationToggleButton.innerHTML = 'Activate';
            }
            let activeStatusColumn = document.getElementById(`user-row-${userId}`).cells[2];
            activeStatusColumn.innerHTML = (activeStatusColumn.innerHTML == 'True') ? 'False' : 'True';
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
                    recordRow.html("<td colspan='6'>No Records Found</td>");
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
