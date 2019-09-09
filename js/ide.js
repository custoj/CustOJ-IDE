var BASE_URL = "https://api.judge0.com";
var SUBMISSION_CHECK_TIMEOUT = 10; // in ms
var WAIT = localStorageGetItem("wait") == "true";

var sourceEditor, inputEditor, outputEditor;
var $selectLanguageBtn, $runBtn, $saveBtn, $vimCheckBox;
var $statusLine, $emptyIndicator;
var timeStart, timeEnd;

function encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function decode(bytes) {
  var escaped = escape(atob(bytes));
  try {
    return decodeURIComponent(escaped);
  } catch {
    return unescape(escaped);
  }
}

function updateEmptyIndicator() {
  if (outputEditor.getValue() == "") {
    $emptyIndicator.html("暂无");
  } else {
    $emptyIndicator.html("");
  }
}

function handleError(jqXHR, textStatus, errorThrown) {
  outputEditor.setValue(JSON.stringify(jqXHR, null, 4));
  $statusLine.html(`${jqXHR.statusText} (${jqXHR.status})`);
}

function handleRunError(jqXHR, textStatus, errorThrown) {
  handleError(jqXHR, textStatus, errorThrown);
  $runBtn.button("reset");
  updateEmptyIndicator();
}

function handleResult(data) {
  timeEnd = performance.now();
  console.log("It took " + (timeEnd - timeStart) + " ms to get submission result.");

  var status = data.status;
  var stdout = decode(data.stdout || "");
  var stderr = decode(data.stderr || "");
  var compile_output = decode(data.compile_output || "");
  var message = decode(data.message || "");
  var time = (data.time === null ? "-" : data.time + "s");
  var memory = (data.memory === null ? "-" : data.memory + "KB");

  $statusLine.html(`${status.description}, ${time}, ${memory}`);

  if (status.id == 6) {
    stdout = compile_output;
  } else if (status.id == 13) {
    stdout = message;
  } else if (status.id != 3 && stderr != "") { // If status is not "Accepted", merge stdout and stderr
    stdout += (stdout == "" ? "" : "\n") + stderr;
  }

  outputEditor.setValue(stdout);

  updateEmptyIndicator();
  $runBtn.button("reset");
}

function toggleVim() {
  var keyMap = vimCheckBox.checked ? "vim" : "default";
  localStorageSetItem("keyMap", keyMap);
  sourceEditor.setOption("keyMap", keyMap);
  focusAndSetCursorAtTheEnd();
}

function run() {
  if (sourceEditor.getValue().trim() == "") {
    alert("代码不能为空!");
    return;
  } else {
    $runBtn.button("loading");
  }

  var sourceValue = encode(sourceEditor.getValue());
  var inputValue = encode(inputEditor.getValue());
  var languageId = $selectLanguageBtn.val();
  var data = {
    source_code: sourceValue,
    language_id: languageId,
    stdin: inputValue
  };

  timeStart = performance.now();
  $.ajax({
    url: BASE_URL + `/submissions?base64_encoded=true&wait=${WAIT}`,
    type: "POST",
    async: true,
    contentType: "application/json",
    data: JSON.stringify(data),
    success: function(data, textStatus, jqXHR) {
      console.log(`Your submission token is: ${data.token}`);
      if (WAIT == true) {
        handleResult(data);
      } else {
        setTimeout(fetchSubmission.bind(null, data.token), SUBMISSION_CHECK_TIMEOUT);
      }
    },
    error: handleRunError
  });
}

function fetchSubmission(submission_token) {
  $.ajax({
    url: BASE_URL + "/submissions/" + submission_token + "?base64_encoded=true",
    type: "GET",
    async: true,
    success: function(data, textStatus, jqXHR) {
      if (data.status.id <= 2) { // In Queue or Processing
        setTimeout(fetchSubmission.bind(null, submission_token), SUBMISSION_CHECK_TIMEOUT);
        return;
      }
      handleResult(data);
    },
    error: handleRunError
  });
}

function setEditorMode() {
  sourceEditor.setOption("mode", $selectLanguageBtn.find(":selected").attr("mode"));
}

function focusAndSetCursorAtTheEnd() {
  sourceEditor.focus();
  sourceEditor.setCursor(sourceEditor.lineCount(), 0);
}

function insertTemplate() {
  var value = parseInt($selectLanguageBtn.val());
  sourceEditor.setValue(sources[value]);
  focusAndSetCursorAtTheEnd();
  sourceEditor.markClean();
}

function loadDefaultLanguage() {
  var childIndex = 1; // C++
  $selectLanguageBtn[0][childIndex].selected = true;
  setEditorMode();
  insertTemplate();
}

function initializeElements() {
  $selectLanguageBtn = $("#selectLanguageBtn");
  $runBtn = $("#runBtn");
  $saveBtn = $("#saveBtn");
  $vimCheckBox = $("#vimCheckBox");
  $emptyIndicator = $("#emptyIndicator");
  $statusLine = $("#statusLine");
}

function localStorageSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (ignorable) {
  }
}

function localStorageGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (ignorable) {
    return null;
  }
}

$(document).ready(function() {
  initializeElements();

  $(function () {
    $('[data-toggle="tooltip"]').tooltip()
  });

  sourceEditor = CodeMirror(document.getElementById("sourceEditor"), {
    lineNumbers: true,
    indentUnit: 4,
    indentWithTabs: true,
    showCursorWhenSelecting: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    keyMap: localStorageGetItem("keyMap") || "default",
    extraKeys: {
      "Tab": function(cm) {
        var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
        cm.replaceSelection(spaces);
      }
    }
  });

  inputEditor = CodeMirror(document.getElementById("inputEditor"), {
    lineNumbers: true,
    mode: "plain"
  });
  outputEditor = CodeMirror(document.getElementById("outputEditor"), {
    readOnly: true,
    mode: "plain"
  });

  $vimCheckBox.prop("checked", localStorageGetItem("keyMap") == "vim").change();

  loadDefaultLanguage();

  $selectLanguageBtn.change(function(e) {
    if (sourceEditor.isClean()) {
      insertTemplate();
    }
    setEditorMode();
  });

  $("body").keydown(function(e){
    var keyCode = e.keyCode || e.which;
    if (keyCode == 120) { // F9
      e.preventDefault();
      run();
    }
  });

  $runBtn.click(function(e) {
    run();
  });

  CodeMirror.commands.save = function(){ save(); };
  $saveBtn.click(function(e) {
    save();
  });

  $vimCheckBox.change(function() {
    toggleVim();
  });
});

// Template Sources
var cSource = "\
#include <stdio.h>\n\
\n\
int main() {\n\
    printf(\"hello, world\\n\");\n\
    return 0;\n\
}\n";

var cppSource = "\
#include <iostream>\n\
using namespace std;\n\
int main() {\n\
    cout << \"hello, world\" << endl;\n\
    return 0;\n\
}\n";

var javaSource = "\
public class Main {\n\
    public static void main(String[] args) {\n\
        System.out.println(\"hello, world\");\n\
    }\n\
}\n";

var python3Source = "print(\"hello, world\")\n";

var python2Source = "print \"hello, world\"\n";

var sources = {
  7: cSource,
 13: cppSource,
 27: javaSource,
 35: python3Source,
 36: python2Source
};

var fileNames = {
  7: "main.c",
 13: "main.cpp",
 27: "Main.java",
 35: "main.py",
 36: "main.py"
};
