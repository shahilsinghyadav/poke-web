```markdown
## WebRTC Call Flow Diagram

```
Caller                          Server                          Callee
  |                               |                               |
  |--- pre-offer (callType) ----->|                               |
  |   (handleCallUser ~155)       |                               |
  |                               |--- pre-offer ---------------->|
  |                               |   (index.js: socket.on)       |
  |                               |                               |--- pre-offer handler (~60)
  |                               |                               |   shows Accept/Reject
  |                               |                               |
  |                               |<-- pre-offer-answer (ACCEPT) -|
  |<-- pre-offer-answer ----------|                               |
  |   (~75, create RTCPeerConn)   |                               |
  |   add local tracks            |                               |
  |   createOffer + setLocalDesc  |                               |
  |--- offer (SDP) -------------->|                               |
  |                               |--- offer -------------------->|
  |                               |                               |--- on "offer" (~130)
  |                               |                               |   setRemoteDesc(offer)
  |                               |                               |   add local tracks
  |                               |                               |   createAnswer + setLocalDesc
  |                               |<-- answer (SDP) --------------|
  |<-- answer (SDP) --------------|                               |
  |   (~150, setRemoteDesc)       |                               |
  |                               |                               |
  |--- ice-candidate ------------>|                               |
  |                               |--- ice-candidate ------------>|
  |                               |                               |--- addIceCandidate (~160)
  |                               |                               |
  |<-- ice-candidate -------------|                               |
  |<-- ice-candidate -------------|                               |
  |   addIceCandidate (~160)      |                               |
  |                               |                               |
  |========= Direct P2P =========>|==============================>|
  |   Media flows via WebRTC      |                               |
  |   (pc.ontrack ~110/140)       |                               |
  |   local <-> remote streams    |                               |
  |                               |                               |
  |--- connectionstatechange ---> logs ("connected")              |
  |                               |                               |
```
