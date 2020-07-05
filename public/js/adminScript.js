$('#EditPracticeLab').on('show.bs.modal', function(event) {
  const button = $(event.relatedTarget);
  const labName = button.data('labName');
  const labCatagory = button.data('labCatagory');
  const katacodaUsername = button.data('katacodaUsername');
  const katacodaScenarioName = button.data('katacodaScenarioName');
  const thumbnailUrl = button.data('thumbnailUrl');
  const labDescription = button.data('labDescription');
  const labId = button.data('labId');
  const modal = $(this);
  modal.find('.modal-title').text('Edit Lab: ' + labName);
  modal.find('.modal-body #labName').val(labName);
  modal.find('.modal-body #catagory').val(labCatagory);
  modal.find('.modal-body #katacodaUsername').val(katacodaUsername);
  modal.find('.modal-body #katacodaScenarioName').val(katacodaScenarioName);
  modal.find('.modal-body #thumbnailUrl').val(thumbnailUrl);
  modal.find('.modal-body #labDescription').val(labDescription);
  $('#labID').val(labId);
})

$('#DeletePracticeLab').on('show.bs.modal', function(event) {
  const button = $(event.relatedTarget);
  const labId = button.data('labId');
  const labName = button.data('labName');
  $('#deleteLabID').val(labId);
  $('#labToDeleteName').text(labName);
})

$('#userExpandModel').on('show.bs.modal', function(event) {
  const button = $(event.relatedTarget);
  const userLoginmethod = button.data('userLoginmethod');
  const userRole = button.data('userRole');
  const userAccountstatus = button.data('userAccountstatus');
  const userBio = button.data('userBio');
  const userGithub = button.data('userGithub');
  const userLinkedin = button.data('userLinkedin');
  const userFullname = button.data('userFullname');
  const userEmail = button.data('userEmail');
  const userProfileimg = button.data('userProfileimg');
  const userFacebookId = button.data('userEmail');
  const userGoogleId = button.data('userGoogleId');
  $("#userProfileimg").attr('src', userProfileimg);
  $("#userFullname").text(userFullname);
  $("#userEmail").text(userEmail);
  $("#userRoleAndStatus").text(userAccountstatus);
  $("#userBio").text(userBio);
  if (userGithub) {
    $("#userGithub").attr('href', "https://github.com/" + userGithub);
    $("#userGithub").removeClass('d-none');
  } else {
    $("#userGithub").attr('href', "");
    $("#userGithub").addClass('d-none');
  }
  if (userLinkedin) {
    $("#userLinkedin").attr('href', "https://linkedin.com/in/" + userLinkedin);
    $("#userLinkedin").removeClass('d-none');
  } else {
    $("#userLinkedin").attr('href', "");
    $("#userLinkedin").addClass('d-none');
  }

  $("#userEmail").text(userEmail);
  $("#userGoogleId").text(userGoogleId);
})

$('#suspendOrActivateAccount').on('show.bs.modal', function(event) {
  const button = $(event.relatedTarget);
  const userId = button.data('userId');
  const userName = button.data('userName');
  const todo = button.data('todo');
  $('#suspendName').text(userName);
  $('#hiddenUserId').attr('value', userId);
  $('#todo').text(todo);
  $('#buttonName').text(todo);
  if (todo === "activate") {
    $('#buttonName').removeClass('btn-danger');
    $('#buttonName').addClass('btn-warning');
    $('#hiddenTodo').attr('value', todo);
  } else {
    $('#buttonName').removeClass('btn-warning');
    $('#buttonName').addClass('btn-danger');
    $('#hiddenTodo').attr('value', todo);
  }
})


function addExamLab() {
  const labDataArray = $("#AddExamLabForm").serializeArray();
  labDataArray.forEach(function(data) {
    if (data.name !== "labDataHTML") {
      if (data.value.trim() === "") {
        $("#" + data.name).addClass("error-custom");;
      } else {
        $("#" + data.name).removeClass("error-custom");;
      }
    }
  });
  if (labDataArray[10].value.trim() !== "") {
    $.ajax({
      type: "POST",
      dataType: "html",
      processData: false,
      url: "https://api.github.com/markdown/raw",
      data: labDataArray[10].value,
      contentType: "text/plain",
      success: function(data) {
        $("#AddExamLabForm").find("input[name=labDataHTML]").remove();
        $("<input />").attr("type", "hidden")
          .attr("name", "labDataHTML")
          .attr("value", data)
          .appendTo("#AddExamLabForm");
        submitExamForm(labDataArray);
      },
      error: function(jqXHR, textStatus, error) {
        console.log(jqXHR, textStatus, error);
      }
    });
  }
}

function submitExamForm(labDataArray) {
  var flag = 0;
  labDataArray.forEach(function(data) {
    if (data.value.trim() === "") {
      flag = 1;
    }
  });
  if (flag == 0) {
    $("#AddExamLabForm").submit();
  }
}


$('#EditExamLab').on('show.bs.modal', function(event) {
  const button = $(event.relatedTarget);
  const labName = button.data('labName');
  const labCatagory = button.data('labCatagory');
  const terminalIpAndPort = button.data('terminalIpAndPort');
  const examDetails = button.data('examDetails');
  const thumbnailUrl = button.data('thumbnailUrl');
  const labDataMarkdown = button.data('labDataMarkdown');
  const startDateAndTime = button.data('startDateAndTime');
  const endDateAndTime = button.data('endDateAndTime');
  const terminalSelector = button.data('terminalSelector');
  const katacodaUsername = button.data('katacodaUsername');
  const katacodaScenario = button.data('katacodaScenario');
  const labId = button.data('labId');
  const modal = $(this);
  modal.find('.modal-title').text('Edit Lab: ' + labName);
  modal.find('.modal-body #labName').val(labName);
  modal.find('.modal-body #catagory').val(labCatagory);
  modal.find('.modal-body #terminal_ip_and_port').val(terminalIpAndPort);
  modal.find('.modal-body #examDetails').val(examDetails);
  modal.find('.modal-body #thumbnailUrl').val(thumbnailUrl);
  modal.find('.modal-body #startDateAndTime').val(startDateAndTime);
  modal.find('.modal-body #endDateAndTime').val(endDateAndTime);
  modal.find('.modal-body #labDataMarkdown').val(labDataMarkdown);
  modal.find('.modal-body #updated_katacoda_username').val(katacodaUsername);
  modal.find('.modal-body #updated_katacoda_scenario').val(katacodaScenario);
  $("#EditExamLab .modal-body input[name=terminal_selector][value=" + terminalSelector + "]").click();
  $('#EditExamLab #labID').val(labId);
});

function editExamLab() {
  const labDataArray = $("#editExamLabForm").serializeArray();
  labDataArray.forEach(function(data) {
    if (data.name !== "labDataHTML") {
      if (data.value.trim() === "") {
        $("#EditExamLab #" + data.name).addClass("error-custom");;
      } else {
        $("#EditExamLab #" + data.name).removeClass("error-custom");;
      }
    }
  });
  if (labDataArray[11].value.trim() !== "") {
    $.ajax({
      type: "POST",
      dataType: "html",
      processData: false,
      url: "https://api.github.com/markdown/raw",
      data: labDataArray[11].value,
      contentType: "text/plain",
      success: function(data) {
        $("#editExamLabForm").find("input[name=labDataHTML]").remove();
        $("<input />").attr("type", "hidden")
          .attr("name", "labDataHTML")
          .attr("value", data)
          .appendTo("#editExamLabForm");
        submitEditExamForm(labDataArray);
      },
      error: function(jqXHR, textStatus, error) {
        console.log(jqXHR, textStatus, error);
      }
    });
  }
}

function submitEditExamForm(labDataArray) {
  var flag = 0;
  labDataArray.forEach(function(data) {
    if (data.value.trim() === "") {
      flag = 1;
    }
  });
  if (flag == 0) {
    $("#editExamLabForm").submit();
  }
}

$('#DeleteExamLab').on('show.bs.modal', function(event) {
  const button = $(event.relatedTarget);
  const labId = button.data('labId');
  const labName = button.data('labName');
  $('#deleteLabID').val(labId);
  $('#labToDeleteName').text(labName);
})

function addExamLabTerminalKatacoda() {
  $("#placeholderForIpAndPort").addClass("d-none");
  $("#placeholderForKatacoda").removeClass("d-none");
  $("#placeholderForIpAndPort input").val("none");
  $("#placeholderForKatacoda input").val("");
}

function addExamLabTerminalIpAndPort() {
  $("#placeholderForIpAndPort").removeClass("d-none");
  $("#placeholderForKatacoda").addClass("d-none");
  $("#placeholderForKatacoda input").val("none");
  $("#placeholderForIpAndPort input").val("");
}

function editExamLabTerminalKatacoda() {
  $("#EditplaceholderForIpAndPort").addClass("d-none");
  $("#EditplaceholderForKatacoda").removeClass("d-none");
}

function editExamLabTerminalIpAndPort() {
  $("#EditplaceholderForIpAndPort").removeClass("d-none");
  $("#EditplaceholderForKatacoda").addClass("d-none");
}

$("#AddNewExamLab #katacoda").click();
