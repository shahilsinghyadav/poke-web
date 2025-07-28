import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {io, Socket} from "socket.io-client";

const VideoCall: React.FC = () => {
  const { email } =useParams();  
  const decodedEmail = decodeURIComponent(email || '');
  const [roomUsers, setRoomUsers] = useState<string[]>([]);
  const [myId, setMySocketId] = useState<string>();
  const socketRef = useRef<Socket | null>(null);    //Restoring the state of socket even on refresh
  const [incomingCall, setIncomingCall] = useState(0);
  const [callerReq, setCallerReq] = useState<{
    isIncoming: boolean,
    callerId : string,
    callType : string
  }| null>(null);
  const webRTCtionRef = useRef<RTCPeerConnection | null>(null);//for state of the webrtc connection of caller & callee
  // const webRTCtionRefCallee = useRef<RTCPeerConnection | null>();
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);


  //on entering need to establish the connection to the sockets
  useEffect(() => {
    if(!socketRef.current){
      socketRef.current = io("http://localhost:3000");
    }
    const socket = socketRef.current;
    socket.on("connect", ()=> {
      setMySocketId(() => socket.id);
      // Join the room with the decoded email
      socket.emit("join-room", { roomId: decodedEmail });
    });
    
    socket.on("room-users", (data) => {
      console.log("Room users:", data.users);
      setRoomUsers(data.users); // Server sends { users: [...] }
    });
    socket.on("user-joined", (data) => {
      setRoomUsers(prev => {
        if (!prev.includes(data.socketId)) {
          return [...prev, data.socketId];
        }
        return prev;
      });
    });
    
    //when a user gets an offer
    socket.on("pre-offer",({ callerSocketId, callType })=>{
      setCallerReq({
        isIncoming: true,
        callerId: callerSocketId,
        callType
      });
    });

    //reading the response from callee on caller side
    socket.on("pre-offer-answer", async (data)=>{
      console.log("Answer : ", data);
      if(data.preOfferAnswer ==="ACCEPTED"){
        webRTCtionRef.current = new RTCPeerConnection();

        webRTCtionRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current?.emit("webRTC-signaling", {
              type: "ice-candidate",
              candidate: event.candidate,
              connectedUserSocketId: data.connectedUserSocketId
            });
          }
        };


        //to display remote user
        webRTCtionRef.current.ontrack = (event) =>{
          console.log("📽️ ontrack fired, remote stream tracks:", event.streams[0].getTracks());
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          event.streams[0].getTracks().forEach((track) => {
            remoteStreamRef.current?.addTrack(track);
          });
          const remoteVideo = document.getElementById("remote-video") as HTMLVideoElement;
          if (remoteVideo && remoteStreamRef.current) {
            remoteVideo.srcObject = remoteStreamRef.current;
          }
          remoteVideo.play().catch(e => console.log("Autoplay blocked:", e));

        }

        localStreamRef.current?.getTracks().forEach(track => {
          webRTCtionRef.current?.addTrack(track, localStreamRef.current!);
        });        
        const offer = await webRTCtionRef.current.createOffer();
        await webRTCtionRef.current.setLocalDescription(offer);
        const localVideo = document.getElementById('local-video') as HTMLVideoElement;
        if (localVideo && localStreamRef.current) {
          localVideo.srcObject = localStreamRef.current;
        }
        socket.emit("webRTC-signaling", {
          type: "offer",
          sdp: offer,
          connectedUserSocketId: data.connectedUserSocketId
        });
        webRTCtionRef.current.onconnectionstatechange = () => {
  console.log("Connection state:", webRTCtionRef.current?.connectionState);
};

      }
    });

    //when callee accepts so for their to say answer on callee side
    socket.on("webRTC-signaling", async(data)=>{
      if(data.type === "offer"){
        webRTCtionRef.current = new RTCPeerConnection();

        webRTCtionRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current?.emit("webRTC-signaling", {
              type: "ice-candidate",
              candidate: event.candidate,
              connectedUserSocketId: data.connectedUserSocketId,
            });
          }
        };


         webRTCtionRef.current.ontrack = (event) => {
          console.log("📽️ ontrack fired, remote stream tracks:", event.streams[0].getTracks());
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          event.streams[0].getTracks().forEach((track) => {
            remoteStreamRef.current?.addTrack(track);
          });
          const remoteVideo = document.getElementById("remote-video") as HTMLVideoElement;
          if (remoteVideo && remoteStreamRef.current) {
            remoteVideo.srcObject = remoteStreamRef.current;
          }
          remoteVideo.play().catch(e => console.log("Autoplay blocked:", e));

        };
        localStreamRef.current?.getTracks().forEach(track => {
          webRTCtionRef.current?.addTrack(track, localStreamRef.current!);
        });
        await webRTCtionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await webRTCtionRef.current.createAnswer();
        await webRTCtionRef.current.setLocalDescription(answer);
        const localVideo = document.getElementById('local-video') as HTMLVideoElement;
        if (localVideo && localStreamRef.current) {
          localVideo.srcObject = localStreamRef.current;
        }
        socket.emit("webRTC-signaling",{
          type: "answer",
          sdp: answer,
          connectedUserSocketId: data.connectedUserSocketId
        });
        webRTCtionRef.current.onconnectionstatechange = () => {
  console.log("Connection state:", webRTCtionRef.current?.connectionState);
};


      }
      if (data.type === "answer") {
        await webRTCtionRef.current?.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
      if (data.type === "ice-candidate") {
        try {
          if (data.candidate) {
            await webRTCtionRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } catch (error) {
          console.error("Error adding received ice candidate", error);
        }
      }
    });
    

    // When a user leaves
    socket.on("user-disconnected", (data) => {
      setRoomUsers(prev => prev.filter(id => id !== data.socketId));
    });
    return () => {
      socket.off("room-users");
      socket.off("user-joined");
      socket.off("user-disconnected");
      socket.disconnect(); // Optional: Only if you're leaving the room
      socketRef.current = null; // Reset socket to null
    };
  }, [decodedEmail]);
  useEffect(() => {// to make sure id is set when the component mounts/changes
        if(myId) {
          console.log("My socket ID:", myId);
        }
  },[myId]);

  useEffect(() => {
    const getMedia = async ()=>{
      try{
        const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        localStreamRef.current = stream;

        const localVideo = document.getElementById("local-video") as HTMLVideoElement;
        if(localVideo)
            localVideo.srcObject = stream;
      }catch(err){
        console.log("Error in local video",err);
        
      }
    };
    getMedia();
  },[])

  function handleCallUser(id:string) {
    socketRef.current?.emit("pre-offer",{calleePersonalCode: id, callType: "video"});//? for silently skipping if "null or undefined"
  };

  function handleAccept(){
    console.log("clicked");
    
    if(callerReq?.callerId){
    socketRef.current?.emit("pre-offer-answer",{
      callerSocketId: callerReq?.callerId,
      preOfferAnswer : "ACCEPTED"
     })
    };
  }

  function handleReject(){
    if (callerReq?.callerId) {
    socketRef.current?.emit("pre-offer-answer", {
      callerSocketId: callerReq.callerId,
      preOfferAnswer: "REJECTED"
    });
    }
  }
  return(
    <div>
      <div>Your Id is : {myId}</div>
      <h2>
        Welcome to the room : {decodedEmail}
      </h2>
      {roomUsers
        .filter((id)=>id!==myId)
        .map((id)=>(
        <div key={id} >
            <span>{id}</span>
            <button onClick={() => handleCallUser(id)}>Call</button>
        </div>
      ))}

      {(callerReq?.isIncoming && (
        <div>
          <button onClick={handleAccept} disabled={!localStreamRef.current}> Accept </button>
          <button onClick={handleReject}> Reject </button>
        </div>
      ))}
      <video id="remote-video" autoPlay playsInline style={{ width: '400px', border: '1px solid black' }} />
      <video id="local-video" autoPlay playsInline muted style={{ width: '400px', border: '1px solid black' }} />

    </div>
  )
};

export default VideoCall;