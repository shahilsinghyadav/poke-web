import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";

import muteIcon from "../assets/mute.png";
import unmuteIcon from "../assets/unmute.png";
import videoOnIcon from "../assets/videoOn.png";
import videoOffIcon from "../assets/videoOff.png";
import '../index.css';

const VideoCall: React.FC = () => {
  const { email } = useParams();
  const decodedEmail = decodeURIComponent(email || "");

  const [roomUsers, setRoomUsers] = useState<string[]>([]);
  const [myId, setMySocketId] = useState<string>();
  const socketRef = useRef<Socket | null>(null);
  const [callerReq, setCallerReq] = useState<{
    isIncoming: boolean;
    callerId: string;
    callType: string;
  } | null>(null);
  const [muted, setMuted] = useState<boolean>(false);
  const [videoOff, setVideo] = useState<boolean>(false);

  const webRTCRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  // ✅ Track who I am connected to
  const peerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io("https://signaling-service-production.up.railway.app");
    }
    const socket = socketRef.current;

    socket.on("connect", () => {
      setMySocketId(socket.id);
      socket.emit("join-room", { roomId: decodedEmail });
    });

    socket.on("room-users", (data) => {
      setRoomUsers(data.users);
    });

    socket.on("user-joined", (data) => {
      setRoomUsers(prev => {
        if (!prev.includes(data.socketId)) {
          return [...prev, data.socketId];
        }
        return prev;
      });
    });
    // incoming call
    socket.on("pre-offer", ({ callerSocketId, callType }) => {
      setCallerReq({
        isIncoming: true,
        callerId: callerSocketId,
        callType,
      });
    });

    //Caller side: callee accepted/rejected
    socket.on("pre-offer-answer", async (data) => {
      console.log("📨 Pre-offer-answer:", data);
      if (data.preOfferAnswer === "ACCEPTED") {
        peerIdRef.current = data.calleeSocketId;

        createPeerConnection();

        // add local tracks
        localStreamRef.current?.getTracks().forEach((track) => {
          webRTCRef.current?.addTrack(track, localStreamRef.current!);
        });

        const offer = await webRTCRef.current!.createOffer();
        await webRTCRef.current!.setLocalDescription(offer);

        socket.emit("webRTC-signaling", {
          type: "offer",
          sdp: offer,
          connectedUserSocketId: peerIdRef.current,
        });
      } else {
        console.log("Call was rejected or user not found");
      }
    });

    // 📡 Handle signaling
    socket.on("webRTC-signaling", async (data) => {

      const sender = data.senderSocketId;
      console.log("📡 Got signaling:", data.type, "from", sender);

      if (data.type === "offer") {
        peerIdRef.current = sender;

        createPeerConnection();

        // add local tracks
        localStreamRef.current?.getTracks().forEach((track) => {
          webRTCRef.current?.addTrack(track, localStreamRef.current!);
        });

        await webRTCRef.current!.setRemoteDescription(
          new RTCSessionDescription(data.sdp)
        );
        const answer = await webRTCRef.current!.createAnswer();
        await webRTCRef.current!.setLocalDescription(answer);

        socket.emit("webRTC-signaling", {
          type: "answer",
          sdp: answer,
          connectedUserSocketId: peerIdRef.current,
        });
      } else if (data.type === "answer") {
        await webRTCRef.current?.setRemoteDescription(
          new RTCSessionDescription(data.sdp)
        );
      } else if (data.type === "ice-candidate") {
        try {
          if (data.candidate) {
            await webRTCRef.current?.addIceCandidate(
              new RTCIceCandidate(data.candidate)
            );
          }
        } catch (err) {
          console.error("Error adding ICE candidate", err);
        }
      }
    });

    // ❌ Handle disconnect
    socket.on("user-disconnected", (data) => {
      setRoomUsers((prev) => prev.filter((id) => id !== data.socketId));
    });
    socket.on("hang-up", () => {
      console.log("📴 Peer hung up, cleaning up...");
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (webRTCRef.current) {
        webRTCRef.current.close();
        webRTCRef.current = null;
      }
      const localVideo = document.getElementById(
        "local-video"
      ) as HTMLVideoElement;
      const remoteVideo = document.getElementById(
        "remote-video"
      ) as HTMLVideoElement;
      if (localVideo) localVideo.srcObject = null;
      if (remoteVideo) remoteVideo.srcObject = null;

      setMuted(false);
      setVideo(true);
      peerIdRef.current = null;
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [decodedEmail]);
  useEffect(() => {// to make sure id is set when the component mounts/changes
    if (myId) {
      console.log("My socket ID:", myId);
    }
  }, [myId]);

  // --- Local Media ---
  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        const localVideo = document.getElementById(
          "local-video"
        ) as HTMLVideoElement;
        if (localVideo) localVideo.srcObject = stream;
      } catch (err) {
        console.error("Error accessing media devices", err);
      }
    };
    getMedia();
  }, []);

  // --- Helpers ---
  function createPeerConnection() {
    webRTCRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    webRTCRef.current.onicecandidate = (event) => {
      if (event.candidate && peerIdRef.current) {
        socketRef.current?.emit("webRTC-signaling", {
          type: "ice-candidate",
          candidate: event.candidate,
          connectedUserSocketId: peerIdRef.current,
        });
      }
    };

    webRTCRef.current.ontrack = (event) => {
      console.log("📹 Remote stream received:", event.streams);
      if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
      event.streams[0].getTracks().forEach((track) => {
        remoteStreamRef.current?.addTrack(track);
      });
      const remoteVideo = document.getElementById(
        "remote-video"
      ) as HTMLVideoElement;
      if (remoteVideo) remoteVideo.srcObject = remoteStreamRef.current;
    };

    webRTCRef.current.onconnectionstatechange = () => {
      console.log("🔗 Connection state:", webRTCRef.current?.connectionState);
    };
  }

  // --- UI actions ---
  function handleCallUser(id: string) {
    socketRef.current?.emit("pre-offer", {
      calleePersonalCode: id,
      callType: "video",
    });
  }

  function handleAccept() {
    if (callerReq?.callerId) {
      socketRef.current?.emit("pre-offer-answer", {
        callerSocketId: callerReq.callerId,
        preOfferAnswer: "ACCEPTED",
      });
      setCallerReq(null);
    }
  }

  function handleReject() {
    if (callerReq?.callerId) {
      socketRef.current?.emit("pre-offer-answer", {
        callerSocketId: callerReq.callerId,
        preOfferAnswer: "REJECTED",
      });
      setCallerReq(null);
    }
  }

  function toggleMute() {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMuted(!audioTrack.enabled);
    }
  }
  function toggleVideo() {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideo(!videoTrack.enabled);
    }
  }
  function handleHangUp() {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());

    if (webRTCRef.current) {
      webRTCRef.current.close();
      webRTCRef.current = null;
    }

    const localVideo = document.getElementById(
      "local-video"
    ) as HTMLVideoElement;
    const remoteVideo = document.getElementById(
      "remote-video"
    ) as HTMLVideoElement;
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;

    setMuted(false);
    setVideo(false);

    socketRef.current?.emit("hang-up", {
      connectedUserSocketId: peerIdRef.current,
    });
    peerIdRef.current=null;
  }

  return (
    <div className="video-chat-page">
      <h3>My ID: {myId}</h3>
      <h2>Room: {decodedEmail}</h2>

      {roomUsers
        .filter((id) => id !== myId)
        .map((id) => (
          <div key={id}>
            <span>{id}</span>
            <button onClick={() => handleCallUser(id)}>📞 Call</button>
          </div>
        ))}

      {callerReq?.isIncoming && (
        <div>
          <p>Incoming {callerReq.callType} call...</p>
          <button onClick={handleAccept}>✅ Accept</button>
          <button onClick={handleReject}>❌ Reject</button>
        </div>
      )}

      <video id="remote-video" className="camera" autoPlay playsInline />
      <video id="local-video" className="camera" autoPlay playsInline muted />

      <div className="button-bar">
        <button onClick={toggleMute}>
          <img
            src={muted ? muteIcon : unmuteIcon}
            alt={muted ? "Unmute" : "Mute"}
            style={{ width: "30px", height: "30px", borderRadius: 50 }}
          />
        </button>

        <button onClick={toggleVideo}>
          <img
            src={videoOff ? videoOffIcon : videoOnIcon}
            alt={videoOff ? "Video Off" : "Video On"}
            style={{ width: "30px", height: "30px" }}
          />
        </button>
        <button
          onClick={handleHangUp}
          style={{ backgroundColor: "red", color: "white", padding: "10px" }}
        >
          End Call
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
