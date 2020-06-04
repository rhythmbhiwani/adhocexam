$(".panel-left").resizable({
  handleSelector: ".splitter",
  resizeHeight: false
});

$('#exampleModal').on('show.bs.modal', function (event) {
  var button = $(event.relatedTarget)
  var recipient = button.data('whatever')
  var modal = $(this)
  modal.find('.modal-title').text('Rules for ' + recipient)
  modal.find('.modal-body input').val(recipient)
});
