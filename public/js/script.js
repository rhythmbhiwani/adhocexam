$(".panel-left").resizable({
  handleSelector: ".splitter",
  resizeHeight: false
});

$('#startExamModel').on('show.bs.modal', function(event) {
  const button = $(event.relatedTarget);
  const examId = button.data('examId');
  $('#startButton').attr('href', "/questions/" + examId);
})
