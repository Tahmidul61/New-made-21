const http=require('http');const fs=require('fs');const path=require('path');
const PORT=process.env.PORT||8000;
const MONGO_URL=process.env.MONGO_URL||process.env.MONGODB_URL||'';
const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.webp':'image/webp'};
function serveFile(res,fp){fs.readFile(fp,(err,data)=>{if(err){res.writeHead(404);res.end('Not Found');return;}const ext=path.extname(fp);res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});res.end(data);});}
function parseBody(req){return new Promise(resolve=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{resolve(JSON.parse(b));}catch{resolve({});}});});}
function jsonRes(res,data,status){status=status||200;res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end(JSON.stringify(data));}
var db=null;
async function connectMongo(){if(!MONGO_URL){console.log('No MONGO_URL');return;}try{const{MongoClient}=require('mongodb');const client=new MongoClient(MONGO_URL,{serverSelectionTimeoutMS:8000});await client.connect();db=client.db('bismi_treats');console.log('MongoDB connected');const cat=await db.collection('catalogue').countDocuments();if(cat===0)await db.collection('catalogue').insertOne({key:'main',cakes:[],accessories:[],flavours:[],hero:{},business:{},announcement:{text:'',enabled:false}});}catch(e){console.log('MongoDB failed:',e.message);}}
const DATA_DIR=path.join(__dirname,'data');const ORDERS_FILE=path.join(DATA_DIR,'orders.json');const REQS_FILE=path.join(DATA_DIR,'customer-requests.json');
function ensureDir(){if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});}
function loadFile(f){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return[];}}
function saveFile(f,d){ensureDir();fs.writeFileSync(f,JSON.stringify(d,null,2));}
var io=null;function emit(ev,data){if(io)io.emit(ev,data);}
const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const url=req.url.split('?')[0];
  if(url==='/api/health')return jsonRes(res,{ok:true,db:db?'mongodb':'file',time:new Date()});
  if(url==='/api/orders'&&req.method==='GET'){if(db)return jsonRes(res,await db.collection('orders').find({}).sort({createdAt:-1}).toArray());return jsonRes(res,loadFile(ORDERS_FILE));}
  if(url==='/api/orders'&&req.method==='POST'){const body=await parseBody(req);if(db){if(Array.isArray(body)){for(const o of body)await db.collection('orders').replaceOne({id:o.id},{...o,updatedAt:new Date()},{upsert:true});emit('orders-updated',{});return jsonRes(res,{ok:true});}const o={...body,createdAt:body.createdAt||new Date(),updatedAt:new Date()};await db.collection('orders').replaceOne({id:o.id},o,{upsert:true});emit('new-order',o);return jsonRes(res,o,201);}if(Array.isArray(body)){saveFile(ORDERS_FILE,body);return jsonRes(res,{ok:true});}const orders=loadFile(ORDERS_FILE);const i=orders.findIndex(o=>o.id===body.id);if(i>=0)orders[i]=body;else orders.push(body);saveFile(ORDERS_FILE,orders);return jsonRes(res,body,201);}
  if(url.startsWith('/api/orders/')&&req.method==='PUT'){const id=parseInt(url.split('/').pop());const body=await parseBody(req);if(db){const r=await db.collection('orders').findOneAndUpdate({id},{$set:{...body,updatedAt:new Date()}},{returnDocument:'after'});if(r){emit('order-updated',r);return jsonRes(res,r);}return jsonRes(res,{error:'Not found'},404);}const orders=loadFile(ORDERS_FILE);const i=orders.findIndex(o=>o.id===id);if(i>=0){orders[i]={...orders[i],...body};saveFile(ORDERS_FILE,orders);return jsonRes(res,orders[i]);}return jsonRes(res,{error:'Not found'},404);}
  if(url.startsWith('/api/orders/')&&req.method==='DELETE'){const id=parseInt(url.split('/').pop());if(db){await db.collection('orders').deleteOne({id});emit('order-deleted',{id});return jsonRes(res,{ok:true});}saveFile(ORDERS_FILE,loadFile(ORDERS_FILE).filter(o=>o.id!==id));return jsonRes(res,{ok:true});}
  if(url==='/api/customer-requests'&&req.method==='GET'){if(db)return jsonRes(res,await db.collection('customer_requests').find({}).sort({submittedAt:-1}).toArray());return jsonRes(res,loadFile(REQS_FILE));}
  if(url==='/api/customer-requests'&&req.method==='POST'){const body=await parseBody(req);if(db){const doc={...body,submittedAt:body.submittedAt||new Date(),updatedAt:new Date()};await db.collection('customer_requests').replaceOne({id:body.id},doc,{upsert:true});emit('new-request',doc);return jsonRes(res,doc,201);}const reqs=loadFile(REQS_FILE);const i=reqs.findIndex(r=>r.id===body.id);if(i>=0)reqs[i]=body;else reqs.push(body);saveFile(REQS_FILE,reqs);return jsonRes(res,body,201);}
  if(url.startsWith('/api/customer-requests/')&&req.method==='DELETE'){const id=parseInt(url.split('/').pop());if(db){await db.collection('customer_requests').deleteOne({id});return jsonRes(res,{ok:true});}saveFile(REQS_FILE,loadFile(REQS_FILE).filter(r=>r.id!==id));return jsonRes(res,{ok:true});}
  if(url==='/api/catalogue'&&req.method==='GET'){if(db)return jsonRes(res,await db.collection('catalogue').findOne({key:'main'})||{});return jsonRes(res,{});}
  if(url==='/api/catalogue'&&req.method==='POST'){const body=await parseBody(req);if(db){await db.collection('catalogue').replaceOne({key:'main'},{key:'main',...body,updatedAt:new Date()},{upsert:true});emit('catalogue-updated',{});return jsonRes(res,{ok:true});}return jsonRes(res,{ok:true});}
  if(url==='/api/customers'&&req.method==='GET'){if(db)return jsonRes(res,await db.collection('customers').find({}).toArray());return jsonRes(res,[]);}
  if(url==='/api/customers'&&req.method==='POST'){const body=await parseBody(req);if(db){await db.collection('customers').replaceOne({email:body.email},{...body,updatedAt:new Date()},{upsert:true});return jsonRes(res,{ok:true},201);}return jsonRes(res,{ok:true});}
  if(url==='/api/stats'){if(db){const[oc,rc,cc]=await Promise.all([db.collection('orders').countDocuments(),db.collection('customer_requests').countDocuments(),db.collection('customers').countDocuments()]);return jsonRes(res,{orders:oc,requests:rc,customers:cc,db:'mongodb'});}return jsonRes(res,{orders:loadFile(ORDERS_FILE).length,requests:loadFile(REQS_FILE).length,customers:0,db:'file'});}
  if(url==='/api/backup'&&req.method==='POST'){if(db){const[orders,requests,customers]=await Promise.all([db.collection('orders').find({}).toArray(),db.collection('customer_requests').find({}).toArray(),db.collection('customers').find({}).toArray()]);ensureDir();const ts=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);const file=path.join(DATA_DIR,'backup-'+ts+'.json');fs.writeFileSync(file,JSON.stringify({orders,requests,customers,at:new Date()},null,2));return jsonRes(res,{ok:true,counts:{orders:orders.length,requests:requests.length,customers:customers.length}});}return jsonRes(res,{ok:false});}

  // Admin login - sets session cookie
  if(url==='/api/admin-login'&&req.method==='POST'){
    const body=await parseBody(req);
    const validUsers=[{user:'Tahmidul',pass:'78674233'},{user:'admin',pass:'admin'}];
    const valid=validUsers.some(u=>u.user===body.username&&u.pass===body.password);
    if(valid){
      const sessionId='bismi_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      res.setHeader('Set-Cookie','bismiSession='+sessionId+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400');
      return jsonRes(res,{ok:true});
    }
    return jsonRes(res,{ok:false,error:'Invalid credentials'},{status:401});
  }
  // Admin logout - clears cookie
  if(url==='/api/admin-logout'&&req.method==='POST'){
    res.setHeader('Set-Cookie','bismiSession=; Path=/; HttpOnly; Max-Age=0');
    return jsonRes(res,{ok:true});
  }
  
  // Photos API - store order photos in MongoDB
  if(url.startsWith('/api/photos/')&&req.method==='GET'){
    const orderId=url.split('/')[3];
    if(db){const doc=await db.collection('photos').findOne({orderId});return jsonRes(res,doc?doc.photos:[]);}
    return jsonRes(res,[]);
  }
  if(url.startsWith('/api/photos/')&&req.method==='POST'){
    const orderId=url.split('/')[3];
    const body=await parseBody(req);
    if(db){await db.collection('photos').replaceOne({orderId},{orderId,photos:body,updatedAt:new Date()},{upsert:true});}
    return jsonRes(res,{ok:true});
  }
  // Calendar access API
  if(url==='/api/calendar-access'&&req.method==='GET'){
    if(db){const doc=await db.collection('settings').findOne({key:'calendarAccess'});return jsonRes(res,doc?doc.data:{});}
    return jsonRes(res,{});
  }
  if(url==='/api/calendar-access'&&req.method==='POST'){
    const body=await parseBody(req);
    if(db){await db.collection('settings').replaceOne({key:'calendarAccess'},{key:'calendarAccess',data:body,updatedAt:new Date()},{upsert:true});}
    return jsonRes(res,{ok:true});
  }
  let fp=path.join(__dirname,url==='/'?'catalogue.html':url);if(!path.extname(fp))fp+='.html';
  // Protect admin pages - require session cookie
  const protectedPages=['admin.html','catalogue-admin.html','kitchen.html','delivery.html','counter.html'];
  const reqFile=path.basename(fp);
  if(protectedPages.includes(reqFile)){
    const cookies=req.headers.cookie||'';
    const hasSession=cookies.includes('bismiSession=') || cookies.includes('bismiAuth=');
    // Also allow if referer is from our site (basic check)
    const referer=req.headers.referer||'';
    const hasReferer=referer.includes('bismitreats') || referer.includes('localhost') || referer.includes('railway.app');
    if(!hasSession && !hasReferer){
      res.writeHead(302,{'Location':'/login.html'});res.end();return;
    }
  }
  if(fs.existsSync(fp))return serveFile(res,fp);serveFile(res,path.join(__dirname,'catalogue.html'));
});
async function start(){ensureDir();await connectMongo();try{const{Server}=require('socket.io');io=new Server(server,{cors:{origin:'*'}});io.on('connection',s=>{console.log('Client:',s.id);s.on('disconnect',()=>console.log('Left:',s.id));});console.log('Socket.io ready');}catch(e){console.log('Socket.io skip:',e.message);}server.listen(PORT,'0.0.0.0',()=>{console.log('Bismi Treats on port '+PORT+' | DB: '+(db?'MongoDB':'File'));});}
start();