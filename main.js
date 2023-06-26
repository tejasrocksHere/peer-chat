let APP_ID = "bed59736eb6041ebb1c3a4e4eaf2a356";
let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;
let localStream;
let remoteStream;
let peerConnection;

let constraints = {
    video: {
        width: { min: 640, ideal: 1920, max: 1920 },
        height: { min: 480, ideal: 1080, max: 1080 }
    },
    audio: true
};

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');
if (!roomId) {
    window.location.href = 'lobby.html';
}

const servers = [{
    iceServers: [
        {
            urls: ['stun:stun1.1.google.com:19302', 'stun:stun2.1.google.com:19302']
        }
    ]
}];

let handleUserJoined = async (MemberId) => {
    console.log("A new user found:", MemberId);
    createOffer(MemberId);
};

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text);
    if (message.type === 'offer') {
        createAnswer(MemberId, message.offer);
    }

    if (message.type === 'answer') {
        addAnswer(message.answer);
    }

    if (message.type === 'candidate') {
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate);
        }
    }
};

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers);
    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';
    document.getElementById('user-1').classList.add('smallFrame');

    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('user-1').srcObject = localStream;
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        event.streams.forEach((stream) => {
            stream.getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        });
    };

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId.uid);
        }
    };
};

let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');
};

let init = async () => {
    try {
        // Give permission for video/audio
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('user-1').srcObject = localStream;

        client = AgoraRTM.createInstance(APP_ID);
        await client.login({ uid, token });
        channel = client.createChannel(roomId);
        await channel.join();
        channel.on('MemberJoined', handleUserJoined);
        channel.on('MemberLeft', handleUserLeft);
        client.on('MessageFromPeer', handleMessageFromPeer);
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }
};

let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId);
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberId.uid);
};

let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId);
    await peerConnection.setRemoteDescription(offer);
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId.uid);
};

let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(answer);
    }
};

let leaveChannel = async () => {
    await channel.leave();
    await client.logout();
};

let toggleCamera = async () => {
    let videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)';
    } else {
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249)';
    }
};

let toggleMic = async () => {
    let audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)';
    } else {
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249)';
    }
};

window.addEventListener('beforeunload', leaveChannel);
document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();
