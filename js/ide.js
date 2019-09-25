var BASE_URL = "http://oj.cust.edu.cn";

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

  if (data.data.err) {
    $statusLine.html(`编译错误 - Compile Error`);
    outputEditor.setValue(data.data.data.replace(/\/judger\/run\/\S+\//g, ""));
  } else {
    data = data.data.data[0];
    var result = data.result;

    if (data.error !== 0) {
      result = 5;
    }
    var time = (data.real_time === null ? "-" : data.real_time + "ms");
    var memory = (data.memory === null ? "-" : Math.floor(data.memory / 1024 / 1024) + "MB");
    if (result === -1) {
      result = 0;
    }
    var description = resultMap[result];

    $statusLine.html(`${description}, ${time}, ${memory}`);
    var output = data.output
    if (data.exit_code !== 0) {
      output += (output == "" ? "" : "\n") + `[WARN] Exited with code ${data.exit_code}.`
    }
    if (data.signal !== 0) {
      output += (output == "" ? "" : "\n") + `[WARN] Killed by signal ${data.signal}.`
    }
    outputEditor.setValue(output);
  }

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

  var sourceValue = sourceEditor.getValue();
  var inputValue = inputEditor.getValue();
  var language = $selectLanguageBtn.val();
  var data = {
    src: sourceValue,
    language: language,
    stdin: inputValue
  };

  timeStart = performance.now();
  $.ajax({
    url: BASE_URL + `/api/debug_submission`,
    type: "POST",
    async: true,
    contentType: "application/json",
    data: JSON.stringify(data),
    success: function(data, textStatus, jqXHR) {
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
  var value = $selectLanguageBtn.val();
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
\tprintf(\"hello, world\\n\");\n\
\treturn 0;\n\
}\n";

var cppSource = "\
#include <iostream>\n\
using namespace std;\n\
int main() {\n\
\tcout << \"hello, world\" << endl;\n\
\treturn 0;\n\
}\n";

var javaSource = "\
public class Main {\n\
\tpublic static void main(String[] args) {\n\
\t\tSystem.out.println(\"hello, world\");\n\
\t}\n\
}\n";

var python3Source = "print(\"hello, world\")\n";

var python2Source = "print \"hello, world\"\n";

var javascriptSource = "console.log(\"hello, world\")\n"

var kotlinSource = "\
fun main() {\n\
\tprintln(\"hello, world\")\n\
}\n"

var scalaSource = "\
object Main extends App {\n\
\tprintln(\"hello, world\")\n\
}\n"

var sources = {
  "C": cSource,
  "C++": cppSource,
  "Java": javaSource,
  "Python3": python3Source,
  "Python2": python2Source,
  "JavaScript": javascriptSource,
  "Kotlin": kotlinSource,
  "Scala": scalaSource
};

var resultMap = {
  0: "运行成功 - Success", 
  1: "时间超限 - Time Limit Exceeded",
  2: "时间超限 - Time Limit Exceeded",
  3: "内存超限 - Memory Limit Exceeded",
  4: "运行错误 - Runtime Error",
  5: "系统错误(请联系管理员) - System Error"
};