chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-ui") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "toggle" });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze") {
    handleAnalysis(request).then(sendResponse);
    return true; 
  }
});

async function handleAnalysis(data) {
  try {
    const dataUrl = await new Promise((resolve) => {
      chrome.tabs.captureVisibleTab(undefined, { format: "png" }, (image) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(image);
        }
      });
    });

    if (!dataUrl) return { success: false, error: "Capture failed" };

    const payload = {
      model: "local-model",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text",text: "what is or are the correct answers of guestion in the center?  first respond with first 2 words of the question, then index of correct responses, then first 2 word of those responses."},
            // { type: "text",text: "CONTEXT:UI:WIMP=Window/Icon/Menu/Pointer;MVC=Model(data)separate View/Controller;Material Design=flat 1dp,rigid,planar shape-shift,vertical move,anims req;Usability=Learnability,Flexibility,Robustness;UI Rules=Workflow,feedback,predictable;Direct Manipulation=visible,instant,reversible;InfoArch=org,nav,reduce;UCD=user-focus;Use Case=intentions;Wireframes=hand-drawn;Testing:Pilot=pre-study;Metrics=cmds/errors/time;Quant=objective/hypothesis;Qual=deep/subjective;FocusGroup=discuss;Verbal=think-aloud;Participants:1=major errors,4-6=80%,15+=map;Gamification=define rules/success,PBL(badges)=rep not core;FLOW=challenge/skill balance.WPF:Desktop fw,logic/view split,Direct3D;XAML=GUI def;Layouts=Grid,Stack,Canvas,Dock;Binding=1Time,1Way,2Way(INotifyPropertyChanged);Converters=type-change;DataContext=source(set 1x).WinAPI:Messages=OS-App comms(WM_PAINT=redraw);DeviceContext=gfx abstract;Input:Focus gets keys,Key=3msgs(down/up/char),Mouse/Key state=msg params/API;Pen:Create->Select->Draw(LineTo)->SelectOld->Delete;Brush!=line color;Resources(.rc)=assets no code;MDI=multi-doc;Modal=blocks parent.Web:AJAX=async partial update,complex dev,bad for static menu;XHR=onreadystatechange calls multi;JSON=text,lighter than XML,no bin opt,parse JSON/eval(!DOM);JS=client interpreted,events,anon func!=run once;DOM=Tree;CSS=style;Media Queries=device/print;Responsive=fluid;HTML5!=replace CSS;Arch:Server=API/Client=App.Qt:QWidget=gfx,QObject=base;QML=declarative(JS/CSS syntax);QtQuick=engine;Signals/Slots=emit/connect(needs QObject);MOC=ext C++;Build=qmake/gcc/moc/uic;Resources=exe embed;Mem=parent deletes child.iOS:UITableView=dataSource.GTK:C/GObject event-driven."}
          ]
        }
      ],
      temperature: 0.7,
    //   max_tokens: 100, // Limit tokens since UI is small
      stream: false
    };

    // const response = await fetch("http://dev-ai.bytestring.net/v1/chat/completions", {
    const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await response.json();

    if (json.choices && json.choices.length > 0) {
        let content = json.choices[0].message.content;

  // Regex to remove content between <think> and </think> tags
  // [\s\S] ensures it matches across newlines
  // *? ensures it is non-greedy (stops at the first closing tag)
  // i flag makes it case-insensitive
  const cleanedContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  return { success: true, data: cleanedContent };
    } else {
      return { success: false, error: "No response" };
    }

  } catch (error) {
    return { success: false, error: error.message };
  }
}