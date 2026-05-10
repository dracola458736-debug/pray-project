// 1. إدارة الشاشات والعناصر
const btnStart = document.getElementById('btn-start-app');
const screenSelect = document.getElementById('screen-select');
const screenTracker = document.getElementById('screen-tracker');
const screenFinish = document.getElementById('screen-finish');
const btnHome = document.getElementById('btn-home');

let selectedPrayerName = "";
let targetRakat = 0;
const prayerData = {
    "الفجر": 2,
    "الظهر": 4,
    "العصر": 4,
    "المغرب": 3,
    "العشاء": 4
};

const athkarText = "استغفر الله (3 مرات)، اللهم أنت السلام ومنك السلام تباركت يا ذا الجلال والإكرام. لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.";

// 2. منطق عد الركعات والتسليم باستخدام MediaPipe
let rakatCount = 0;
let isSajda = false;
let sajdaInCurrentRaka = 0;
let isWaitingForSalam = false;
let salamLookedRight = false;
let salamLookedLeft = false;

const videoElement = document.getElementById('cam-video');
const canvasElement = document.getElementById('cam-canvas');
const canvasCtx = canvasElement.getContext('2d');
const rakatDisplay = document.getElementById('rakat-display');
const totalRakatTargetDisplay = document.getElementById('total-rakat-target');
const currentPrayerNameDisplay = document.getElementById('current-prayer-name');

function onResults(results) {
    if (!results.poseLandmarks) return;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    const landmarks = results.poseLandmarks;
    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];

    // تتبع الركعات (فقط إذا لم نكن في مرحلة انتظار السلام)
    if (!isWaitingForSalam) {
        if (nose.y > 0.85 && !isSajda) {
            isSajda = true;
            sajdaInCurrentRaka++;
            
            if (sajdaInCurrentRaka === 2) {
                rakatCount++;
                sajdaInCurrentRaka = 0;
                rakatDisplay.innerText = rakatCount;
                playNotificationSound();

                // التحقق من انتهاء عدد الركعات المطلوب
                if (rakatCount >= targetRakat) {
                    isWaitingForSalam = true;
                    playSuccessSound();
                }
            }
        } 
        else if (nose.y < 0.6) {
            isSajda = false;
        }
    } 
    // تتبع السلام في نهاية الصلاة
    else {
        // حساب المسافة الأفقية بين الأنف والأذنين لتحديد اتجاه الرأس
        const noseToLeftEar = Math.abs(nose.x - leftEar.x);
        const noseToRightEar = Math.abs(nose.x - rightEar.x);

        // السلام يميناً (الأنف يقترب من الأذن اليمنى أو يبتعد كثيراً عن اليسرى حسب وضع الكاميرا)
        if (nose.x < leftEar.x - 0.05 && !salamLookedRight) {
            salamLookedRight = true;
            console.log("تم رصد التسليم يميناً");
        }
        // السلام يساراً (بعد اليمين)
        if (salamLookedRight && nose.x > rightEar.x + 0.05 && !salamLookedLeft) {
            salamLookedLeft = true;
            console.log("تم رصد التسليم يساراً");
            finishPrayer();
        }
    }
    canvasCtx.restore();
}

function finishPrayer() {
    setTimeout(() => {
        screenTracker.classList.remove('active');
        screenFinish.classList.add('active');
        document.getElementById('prayer-athkar').innerText = athkarText;
    }, 1000);
}

if (btnHome) {
    btnHome.onclick = () => window.location.href = 'index.html';
}

// إعداد الكاميرا والذكاء الاصطناعي
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({ 
    modelComplexity: 1, 
    smoothLandmarks: true,
    minDetectionConfidence: 0.5, 
    minTrackingConfidence: 0.5 
});
pose.onResults(onResults);

document.querySelectorAll('.prayer-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        selectedPrayerName = btn.querySelector('span').innerText;
        targetRakat = prayerData[selectedPrayerName] || 4;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            
            currentPrayerNameDisplay.innerText = `صلاة ${selectedPrayerName}`;
            totalRakatTargetDisplay.innerText = targetRakat;
            rakatCount = 0;
            rakatDisplay.innerText = "0";
            isWaitingForSalam = false;
            salamLookedRight = false;
            salamLookedLeft = false;

            screenSelect.classList.remove('active');
            screenTracker.classList.add('active');
            startCamera();
        } catch (err) {
            alert('عذراً، يجب السماح بالوصول للكاميرا ليعمل العداد الذكي.');
        }
    });
});

function startCamera() {
    const camera = new Camera(videoElement, {
        onFrame: async () => { await pose.send({image: videoElement}); },
        width: 640, height: 480
    });
    camera.start();
}

function playNotificationSound() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
}

function playSuccessSound() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
}