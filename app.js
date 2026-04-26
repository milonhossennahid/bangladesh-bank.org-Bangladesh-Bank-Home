function showSignup() {document.getElementById('signupBox').style.display = 'block';}
function hideSignup() {document.getElementById('signupBox').style.display = 'none';}
function login() {
  let username = document.getElementById('loginUsername').value.trim();
  let password = document.getElementById('loginPassword').value;
  let error = document.getElementById('loginError');
  error.style.display = "none";
  if (!username || !password) {error.innerText = "Enter AC number & password!";error.style.display = "block";return;}
  db.ref("users/"+username).once("value").then(snap=>{
    if (!snap.exists()) {error.innerText = "User not found!";error.style.display = "block";return;}
    let userdata = snap.val();
    if (userdata.password !== password) {error.innerText = "Wrong password!";error.style.display = "block";return;}
    if (userdata.status && userdata.status !== "approved" && userdata.status !== "active") {error.innerText = "User not approved!";error.style.display = "block";return;}
    showUserPanel(userdata);
    db.ref("login_history").push({username:userdata.username||userdata.mobile,name:userdata.name,time:Date.now()});
  }).catch(e=>{error.innerText = "Error: " + e.message;error.style.display = "block";});
}
function signup() {
  let name = document.getElementById('signupName').value.trim();
  let mobile = document.getElementById('signupMobile').value.trim();
  let password = document.getElementById('signupPassword').value;
  let error = document.getElementById('signupError');
  error.style.display = "none";
  if (!name || !mobile || !password) {error.innerText = "Fill all fields!";error.style.display = "block";return;}
  db.ref("users/"+mobile).set({
    name, mobile, username: mobile, password, balance: 0, status: "pending", txn:[], card_issued: Date.now(), reg_time: Date.now()
  }).then(() => {
    alert("Registration successful! Wait for approval.");
    hideSignup();
  }).catch(e=>{error.innerText = "Error: " + e.message;error.style.display = "block";});
}
function showUserPanel(user) {
  window.myUser = user;
  document.getElementById('mainPanel').style.display = 'none';
  document.getElementById('userPanel').style.display = 'block';
  document.getElementById('upName').innerText = user.name;
  document.getElementById('upMobile').innerText = user.mobile;
  document.getElementById('upBalance').innerText = (user.balance?.toFixed(1)||"00.0");
  document.getElementById('userAvatar').innerText = user.name[0];
  document.getElementById('cardHolder').innerText = user.name;
  let dt = new Date(user.card_issued||Date.now());
  let mm = (dt.getMonth()+1).toString().padStart(2,'0');
  let yy = (dt.getFullYear()+3).toString().slice(2);
  document.getElementById('cardExpiry').innerText = `${mm}/2${yy}`;
  document.getElementById('cardCVV').innerText = makeCVV(user.mobile);
  document.getElementById('cardNum').innerText = maskCardNum(user.mobile);
  loadLiveHistory(user.mobile);
}
function maskCardNum(num) {
  let s=String(num).padEnd(12,"0");
  return s.replace(/(.{4})/g, "$1 ").trim();
}
function makeCVV(mobile) {
  let s = String(mobile);
  return s.length>=3?s.slice(-3):"999";
}
function userLogout() {
  document.getElementById('userPanel').style.display = 'none';
  document.getElementById('mainPanel').style.display = 'flex';
}
function showWithdrawModal() {
  hideAllModals();
  document.getElementById('withdrawModal').style.display='flex';
}
function showDepositModal() {
  hideAllModals();
  document.getElementById('depositModal').style.display='flex';
}
function showLiveChat() {
  hideAllModals();
  document.getElementById('liveChatBox').style.display='block';
}
function hideLiveChat() {document.getElementById('liveChatBox').style.display='none';}
function hideModal(id) {document.getElementById(id).style.display='none';}
function hideAllModals() {
  ['withdrawModal','depositModal','liveChatBox'].forEach(id=>{
    let el = document.getElementById(id);
    if(el) el.style.display='none';
  });
}
function submitWithdraw() {
  let type = document.getElementById('withdrawType').value;
  let to = document.getElementById('withdrawTo').value.trim();
  let amt = parseFloat(document.getElementById('withdrawAmt').value);
  let error = document.getElementById('withdrawError');
  error.style.display = "none";
  if (!to || !amt || amt<=0) {error.innerText = "Fill all fields!";error.style.display = "block";return;}
  let uname = window.myUser.mobile;
  db.ref("users/"+uname).once("value").then(snap=>{
    let u = snap.val();
    if (u.balance < amt) {error.innerText = "Insufficient balance!";error.style.display = "block";return;}
    let reqid = "wd"+Date.now();
    db.ref("withdraw_requests/"+reqid).set({
      user: uname, name: u.name, amount: amt, to, type, status: "pending", req_time: Date.now()
    });
    db.ref("users/"+uname+"/balance").set(u.balance-amt);
    db.ref("users/"+uname+"/last_wd_req").set(reqid);
    alert("Withdraw request submitted!");
    hideModal('withdrawModal');
    showUserPanel({...u,balance:u.balance-amt});
  });
}
function submitDeposit() {
  let txnid = document.getElementById('depositTxn').value.trim();
  let amt = parseFloat(document.getElementById('depositAmt').value);
  let error = document.getElementById('depositError');
  error.style.display = "none";
  if (!txnid || !amt || amt<=0) {error.innerText = "Enter txn ID & amount!";error.style.display = "block";return;}
  let uname = window.myUser.mobile;
  db.ref("addfund_requests/af"+Date.now()).set({
    user: uname, name: window.myUser.name, amount: amt, txnid, status: "pending", req_time: Date.now()
  });
  alert("Add Funds request submitted! Approve হলে ব্যালেন্স বাড়বে।");
  hideModal('depositModal');
}
function loadLiveHistory(uname) {
  let box = document.getElementById('liveHistory');
  box.innerHTML = "Loading History...";
  db.ref("withdraw_requests").orderByChild("user").equalTo(uname).limitToLast(20).once("value").then(snap=>{
    if (!snap.exists()) { box.innerHTML = "No withdraw requests yet."; return; }
    let html = "<b>Withdraw Requests:</b><br>";
    snap.forEach(child=>{
      let d = child.val();
      let status = d.status=="pending" ? "<span class='live-status-pending'>Pending</span>" :
                  d.status=="approved" ? "<span class='live-status-approved'>Approved</span>" :
                  "<span class='live-status-rejected'>Rejected</span>";
      html += `
        <div>
          <b>${d.type.toUpperCase()}</b> → ${d.to} — <b>${d.amount}৳</b>
          [${status}]
        </div>
      `;
    });
    box.innerHTML = html;
  });
}