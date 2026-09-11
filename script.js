
const gate = document.getElementById("gate");
const smoog = document.getElementById("smoog");
const net = document.getElementById("net");
const content = document.getElementById("content");
const smoogSound = new Audio("audio/smoog.mp3");
const netSound = new Audio("audio/net.mp3");

const SMOOG_DELAY = 500;
const NET_DELAY = 1500;
const CONTENT_DELAY = 2500;

function unlock(sound) {
    sound.play().catch(() => { });
    sound.pause();
    sound.currentTime = 0;
}
gate.addEventListener("click", () => {
    unlock(smoogSound);
    unlock(netSound);

    gate.classList.add("gone");

    setTimeout(() => {
        smoog.classList.add("visible");
        smoogSound.play().catch(() => { });
    }, SMOOG_DELAY);

    setTimeout(() => {
        net.classList.add("visible");
        netSound.play().catch(() => { });
    }, NET_DELAY);

    setTimeout(() => {
        content.classList.add("visible");
    }, CONTENT_DELAY);

});
