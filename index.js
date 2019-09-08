// helpers
const $ = id => document.getElementById(id);
const logLoaderMsg = msg => ($("loader").innerText = msg);
const DB = "dataset";
const saveClassifier = classifier => {
  let dataset = classifier.getClassifierDataset();
  var datasetObj = {};
  Object.keys(dataset).forEach(key => {
    let data = dataset[key].dataSync();
    datasetObj[key] = Array.from(data);
  });
  let jsonStr = JSON.stringify(datasetObj);
  //can be change to other source
  window.db.set(DB, jsonStr);
};

const loadClassifier = async classifier => {
  //can be change to other source
  let dataset = await window.db.get(DB);

  if (!dataset) return;

  let tensorObj = JSON.parse(dataset);
  //covert back to tensor
  Object.keys(tensorObj).forEach(key => {
    tensorObj[key] = tf.tensor(tensorObj[key], [
      tensorObj[key].length / 1000,
      1000
    ]);
  });
  classifier.setClassifierDataset(tensorObj);
};

let net,
  classes = [],
  lastClassified;

const classifier = knnClassifier.create();
const webcamElement = document.getElementById("cam");

async function setupWebcam() {
  return new Promise((resolve, reject) => {
    const navigatorAny = navigator;
    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigatorAny.webkitGetUserMedia ||
      navigatorAny.mozGetUserMedia ||
      navigatorAny.msGetUserMedia;
    if (navigator.getUserMedia) {
      navigator.getUserMedia(
        { video: { facingMode: "environment" } },
        stream => {
          webcamElement.srcObject = stream;
          webcamElement.addEventListener("loadeddata", () => resolve(), false);
        },
        () => {
          alert("Need access to camera to do Image Classification");
          reject();
        }
      );
    } else {
      reject();
    }
  });
}

async function app() {
  // Load the model.
  logLoaderMsg("Loading the model...");
  net = await mobilenet.load();

  // await loadClassifier(classifier);

  // prep the camera
  logLoaderMsg("Preparing the camera...");
  await setupWebcam();

  document.body.classList.add("ready");

  // Reads an image from the webcam and associates it with a specific class
  // index.
  const addClass = classId => {
    // Get the intermediate activation of MobileNet 'conv_preds' and pass that
    // to the KNN classifier.
    const activation = net.infer(webcamElement, "conv_preds");

    // Pass the intermediate activation to the classifier.
    classifier.addExample(activation, classId);
    // saveClassifier(classifier);
  };

  // adds the current image as a new class
  $("add").addEventListener("click", () => {
    const classId = prompt("Classify as", lastClassified).trim();

    // if no class id is given
    if (!classId) {
      return;
    }

    // if its a new class
    classes.indexOf(classId) === -1 && classes.push(classId);
    lastClassified = classId;

    addClass(classId);
  });

  // clear the classifier
  $("reset").addEventListener("click", () => {
    classifier.clearAllClasses();
    // window.db.clear();
  });

  while (true) {
    const totalClasses = classifier.getNumClasses();
    $("totalClasses").innerText = totalClasses;

    if (totalClasses > 0) {
      // Get the activation from mobilenet from the webcam.
      const activation = net.infer(webcamElement, "conv_preds");
      // Get the most likely class and confidences from the classifier module.
      const result = await classifier.predictClass(activation);

      $("console").innerText = `Classified ${classes[result.classIndex]}
        ${Math.round(result.confidences[result.label] * 100)}% confidence`;
    } else {
      $("console").innerText = "";
    }

    await tf.nextFrame();
  }
}

app();
