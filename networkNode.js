const express = require('express');		//for api access
const app = express();
var sha256 = require("sha256");
const bodyparser=require("body-parser");	//by body parser we could use any item being posted by req.body
const Wallet=require("./wallet"); 
const wallet =new Wallet(); 
const port=process.env.port||3001;	//port is for different nodes here we are fetching port from what we are entering in node eg:port=3002 npm start =>http://localhost:3002 & if we dont pass any port eg.npm start =>http://localhost:3001
const rp=require("request-promise");	//to allow request to nodes
const Blockchain=require("./blockchain"); //we are importing global data(this.) of function Blockchain() of blockchain.js by importing it as module thus ./filename(case insensitive)
const AlphaCoin=new Blockchain();


app.use(bodyparser.json());		//it shows we will send a json file
app.use(bodyparser.urlencoded({extended:false}));		//true: if we want to accept all data types false:if we want only string or array
 
//to fetch entire blockchain
app.get('/', function (req, res) 
{
  res.send(AlphaCoin)
});



//to create new transactions and broadcast that new trx to all other nodes in network
app.get('/generatewallet', function (req, res) 
{ 
  const wallet =new Wallet();         //will generate the  new wallet when called
  const walletdata={PublicKey:wallet.publicKey,                     //generated wallet data
                    PublicAddress:wallet.publicAddress,
                    PrivateKeyHash:sha256(wallet.privateKey),
                    Balance:wallet.Balance,
                    Transactions:wallet.Transactions
                    };
  AlphaCoin.allWallets(walletdata);               //adding wallet data to all wallets array
  const requestWalletPromises=[];
 AlphaCoin.networkNodes.forEach(networkNodeUrl=>
 {
  const requestOptions= //this broadcast request will reach to every existing nodes
    {
      uri:networkNodeUrl + '/wallet', //making this request to the wallet endpoint on each existing old nodes   eg: uri: 'http://localhost:3005/wallet'
      method:'POST',  
      body:walletdata, //sends newly generated walletdata to each node 
      json:true 
    };
    requestWalletPromises.push(rp(requestOptions));
 });
 Promise.all(requestWalletPromises)    //to run all promises stored in array after successfully running this it is ensured that the new wallet is being broadcasted completly with all nodes
 .then(data=>
 {  
  res.json({"Your Wallet (COPY PRIVATE KEY)":
                    {
                    PublicAddress:wallet.publicAddress,      //printing the wallet data to the user who generated wallet
                    PrivateKey:wallet.privateKey,
                    Balance:wallet.Balance,
                    PublicKey:wallet.publicKey
                    }});
 });
});




//to add the newly generated walletdata received from above to the wallets array of each node in the network
app.post('/wallet', function (req, res) 
{
 const walletdata=req.body;
 AlphaCoin.allWallets(walletdata);
 res.json({note:`This wallet is broadcasted`});
});




//to create new transactions and broadcast that new trx to all other nodes in network
app.post('/transactions/broadcast', function (req, res) 
{ 
  //ONly for regular transactions
  const senderWallet=(AlphaCoin.searchWallet(req.body.PublicAddress)).senderWallet;
  if(senderWallet===null||(senderWallet.PrivateKeyHash!==sha256(req.body.PrivateKey)))
  {
     res.json({Alert:"Invalid Address or PrivateKey"});
            return;
  }
  const keyPair1=wallet.keyFromPrivate(req.body.PrivateKey);
  const transactionhash=sha256(req.body.PublicAddress+req.body.recipient+req.body.amount.toString()); //hash of the transaction's input data
  const signature=keyPair1.sign(transactionhash); //signing the trx hash
  const fees=req.body.fees||0.0005;
  const note=undefined; 
  let senderbalance=senderWallet.Balance;
  const newTransactions=AlphaCoin.createNewTransaction(req.body.amount,req.body.recipient,note,req.body.PublicAddress,fees);  //new trx will be created
  if((req.body.amount>=senderbalance-fees)||(req.body.amount<fees)||(fees>senderbalance))
          {
            res.json({Alert:"Invalid Transaction"});
            return;
          }
 const publicKey=senderWallet.PublicKey;
 const keyPair2=wallet.keyFromPublic(publicKey);
 const verificationstatus=keyPair2.verify(transactionhash,signature);  //verifying the signature by trx hash,signature and pub key
 if(!verificationstatus)
 {
  res.json({Alert:"Invalid Transaction"});
  return;
 }
 AlphaCoin.addTransactionToPendingTransaction(newTransactions);  //new trx will be added to the pending trx 
 const requestTransactionPromises=[];
 AlphaCoin.networkNodes.forEach(networkNodeUrl=>
 {
 	const requestOptions=	//this broadcast request will reach to every existing nodes
  	{
  		uri:networkNodeUrl + '/transactions',	//making this request to the transactions endpoint on each existing old nodes 	eg: uri: 'http://localhost:3005/transactions'
  		method:'POST',	
  		body:{newTransactions:newTransactions,
            transactionhash:transactionhash,
            signature:signature,
            publicKey:publicKey},	//sends new trx,trx hash,senderpubkey & signature to each node 
  		json:true	
  	};
  	requestTransactionPromises.push(rp(requestOptions));
 });
 Promise.all(requestTransactionPromises)		//to run all promises stored in array after successfully running this it is ensured that the new transactions is being broadcasted completly with all nodes
 .then(data=>
 {
 res.json({note:`Transaction added to pending transactions pool`});
 });
});


//to add the new trx received from above to the pending trx array of each node in the network
app.post('/transactions', function (req, res) 
{
 const newTransactions=req.body.newTransactions;
 const transactionhash=req.body.transactionhash;
 const signature=req.body.signature;
 const PublicKey=req.body.publicKey;
 const keyPair2=wallet.keyFromPublic(PublicKey);
 const verificationstatus=keyPair2.verify(transactionhash,signature);  //verifying the signature by trx hash,signature and pub key
 if(!verificationstatus)
 {
  res.json({Alert:"Invalid Transaction"});
  return;
 }
 AlphaCoin.addTransactionToPendingTransaction(newTransactions);
res.json({note:`Transaction added to pending transactions pool`});
});


//to mine/create new block which is done by a single node and then this node will broadcast it to other nodes
app.post('/mine', function (req, res) 
{	
  const minerWallet=(AlphaCoin.searchWallet(req.body.PublicAddress)).senderWallet;
  if(!minerWallet)
  {
    res.json({note:`Not a valid Address you can't mine`});
    return;
  }
	const lastBlock=AlphaCoin.getLastBlock();
	const previousBlockHash=lastBlock['Hash'];
  let blockreward=lastBlock.BlockReward;
  blockreward=(lastBlock.Index)%10==0?blockreward/2:blockreward;    //halfs blockreward after every 10th block
  const pendingTransactions=AlphaCoin.pendingTransactions;
  Blockreward(minerWallet,blockreward);
  pendingTransactions.splice(0,0,pendingTransactions.splice(pendingTransactions.length-1)[0]);
  const currentblockdata=
	{
		Index:lastBlock['Index']+1,	//current block no.(starting our counting from one)
		Transactions: pendingTransactions	//all pending new trx that are waiting to be mined
	};
  const nextblockhash=null;
  const previousDifficulty=lastBlock["Difficulty"];
  const lastBlockTime=lastBlock["Timestamp"];
  const difficulty=AlphaCoin.adjustDifficulty(previousDifficulty,lastBlockTime);  //dificulty for the next block to mined getting determined by the help of adjustDifficulty function
  const nonce=AlphaCoin.proofOfWork(previousBlockHash,currentblockdata,difficulty);
	const hash =AlphaCoin.hashBlock(previousBlockHash,currentblockdata,nonce);
  const mineTime=Date.now()-lastBlockTime; //time took to mine this block after the previous block
  const newBlock=AlphaCoin.createNewBlock(nonce,previousBlockHash,hash,nextblockhash,mineTime,port,blockreward,difficulty);
  const requestMinePromises=[];
	AlphaCoin.networkNodes.forEach(networkNodeUrl=>
	{
	const requestOptions=	//this broadcast request will reach to every existing nodes
  	{
  		uri:networkNodeUrl + '/receive-new-block',	//making this request to the recieve ne block endpoint on each existing old nodes 	eg: uri: 'http://localhost:3005/recieve-new-block'
  		method:'POST',	
  		body:{newBlock:newBlock},	//sends new block to each node 
  		json:true	
  	};
  	requestMinePromises.push(rp(requestOptions));
    });
  lastBlock.NextBlockHash=hash;
	res.json({"note":`Block #${currentblockdata.Index} is Mined by ${port} in ${mineTime/1000} seconds`,"Block" :newBlock});
});


function Blockreward(minerWallet,blockreward)     //Exclusive for block reward
{ 
  const allpendingtransactionfees=AlphaCoin.allpendingtransactionfees();
  amount=blockreward+allpendingtransactionfees;//mining reward(block reward+trx fees) of this mined block will be added as a trx into the next block mined
  senderaddress="Unable to decode address (Newly generated Coin)"; 
  note="Block Reward";     //adding a note that represent block reward
  recipient=minerWallet.PublicAddress;   //Public Address of the Block Miner
  const newTransactions=AlphaCoin.createNewTransaction(amount,recipient,note,senderaddress); 
  AlphaCoin.addTransactionToPendingTransaction(newTransactions);  //new trx will be added to the pending trx
  return ;
};
 


//all other nodes verify the mined block and will recieve the block
app.post('/receive-new-block', function (req, res) 
{
 const newBlock=req.body.newBlock;
 const hash=newBlock.Hash;
 const lastBlock=AlphaCoin.getLastBlock();
 const validateNonce=AlphaCoin.hashBlock(lastBlock.Hash,{ Index:newBlock.Index,Transactions:newBlock.Transactions},newBlock.Nonce);  //validating blockchain by re-hashing the block and verifying its nonce
 const newBlockTimestamp=newBlock.Timestamp;        
 const lastBlockTimestamp=lastBlock.Timestamp;                           //hash recieved after verifying should be <= to the mined block hash   timestamp of the new block should be always greater than old once   blocksize should less than 1MB
 const isValidBlock=((lastBlock.Hash===newBlock.PreviousBlockHash)&&(newBlock.Index===lastBlock.Index+1)&&(newBlockTimestamp>lastBlockTimestamp)&&(newBlock.NumberOfTransactions!==0) &&(validateNonce===hash)&&(newBlock.Size_kB<1024))	//validate previous blockhash that is mentioned in the new block is it equal to the hash of previous block and index of new block is +1 then last block
 if(isValidBlock)
 {
 	AlphaCoin.chain.push(newBlock);		//if mined block is valid it is added to the Blockchain
  lastBlock.NextBlockHash=hash;     //for updating the next blockhash value in all nodes who recieves the new mined block
  newBlock.Transactions.forEach(transaction=>
  {   const foundWallet=AlphaCoin.searchWallet(transaction.Sender,transaction.Recipient);
      const recipientWallet=foundWallet.recipientWallet;
      const senderWallet=foundWallet.senderWallet;
      AlphaCoin.updateWallet(recipientWallet,transaction,transaction.EstimatedAmountTransacted,transaction.Fees,senderWallet); 
  });
  AlphaCoin.pendingTransactions=[];	//pending transactions are cleared
 	res.json({Status:"Valid Block"});
 }
 else
 {
 	res.json({Alert:"Invalid Block"});
 }
});


//register a node and broadcast it to the whole network
app.post('/register-and-broadcast-node', function (req, res) {
  const newNodeUrl=req.body.newNodeUrl;		//url of the new node to add to the network
  const notCurrentNode=AlphaCoin.currentNodeUrl!==newNodeUrl;   //to validate that the new node is not the current node
  if(AlphaCoin.networkNodes.indexOf(newNodeUrl)==-1 && notCurrentNode)	//to validate if a node Url doesn't already exist(registered)
  {
  	AlphaCoin.networkNodes.push(newNodeUrl);	//new nodes get registered
  }
   else if(!notCurrentNode ||AlphaCoin.networkNodes.indexOf(newNodeUrl)!==-1)
  {
    res.json({note:"THIS NODE IS EITHER REGISTERED OR IS A CURRENT NODE"});
    return;
  };
  const regNodesPromises=[];
  AlphaCoin.networkNodes.forEach(networkNodeUrl =>		//broadcasting the new node to each existing nodes
  {		
  	const requestOptions=	//this broadcast request will reach to every existing nodes
  	{
  		uri:networkNodeUrl + '/register-node',	//making this request to the register-node endpoint on each existing old nodes 	eg: uri: 'http://localhost:3005/register-node'
  		method:'POST',	//for register-node to happen we need post method
  		body:{newNodeUrl:newNodeUrl},	//url of new node as its identity is what we pass along with this request 	eg: body: { newNodeUrl: 'http://localhost:3005' }
  		json:true	//to send as json data 
  	};
  	regNodesPromises.push(rp(requestOptions));	//As rp is request promise thus each this request options will send request to each old nodes and return us a promise(pending promise till now) which we will store in array for further use
  });
  Promise.all(regNodesPromises)		//to run all promises stored in array after successfully running this it is ensured that the new node is being regitered with others broadcasting completed 
  .then(data=>{						//then all the data we get from these promises 
 	const bulkRequestOptions=	//this broadcast request will reach to the new node
  	{
  		uri:newNodeUrl + '/register-nodes-bulk',	///making this request to the register-nodes-bulk endpoint on the new node
  		method:'POST',	//for register-nodes-bulk to happen we need post method
  		body:{allNetworkNodes:[...AlphaCoin.networkNodes,AlphaCoin.currentNodeUrl]},	//we pass url of every old nodes as well as current nodeurl with this request as there identity
  		json:true	//to send as json data 
  	};
  	return rp(bulkRequestOptions);		//running of bulk request and all nodes are regitered with new node
  })
  .then(data=>{	
  	res.json({note:"New node registered with the network"});
  });
});


//when the above will broadcast the node to the other nodes(network) then for these nodes(network) they will just register this node & will not broadcast it further bcoz it is unnecessary to broadcast a node repeatedly as it will make infinite loop
app.post('/register-node', function (req, res) {	//the new node will be registered with the current node
  const newNodeUrl=req.body.newNodeUrl;
  const notCurrentNode=AlphaCoin.currentNodeUrl!==newNodeUrl;	//to validate that the new node is not the current node
  if(AlphaCoin.networkNodes.indexOf(newNodeUrl)==-1 && notCurrentNode)	//only register the new node if it isn't already present and not a current node
  {
  	AlphaCoin.networkNodes.push(newNodeUrl);
  }
  res.json({note:"New node registered to the network"});
});


//register multiple nodes at once ; whenever we invoke this we are on the new node
app.post('/register-nodes-bulk', function (req, res) 		//the new node will recieve data of every existing nodes in network and would register it with them
{	
  const allNetworkNodes= req.body.allNetworkNodes;
  allNetworkNodes.forEach(networkNodeUrl =>			//register each existing node with the new node
 {		
  const notCurrentNode=AlphaCoin.currentNodeUrl!==networkNodeUrl;
  if(AlphaCoin.networkNodes.indexOf(networkNodeUrl)==-1 && notCurrentNode)
  {
  AlphaCoin.networkNodes.push(networkNodeUrl);
  } 
  });
  res.json({note:"Bulk Registration successfull"});
});


//it is a consensus algorithm which uses chainIsValid method, it takes the copy of blockchain from each node and compares with it's own copy of blockchain
app.get('/consensus', function (req, res)    
{  const chainPromises=[];
   AlphaCoin.networkNodes.forEach(networkNodeUrl =>   //looping through each node
  { 
    const requestOptions=
    {
      uri:networkNodeUrl ,  //making this request to the blockchain endpoint from each node
      method:'GET',  //it is only get request
      json:true //to send as json data 
    };
    chainPromises.push(rp(requestOptions));
  });
  Promise.all(chainPromises)
  .then(blockchains=>       //here data is the set of all node's blockchain
  {           
    const currentChainLength=AlphaCoin.chain.length; 
    let maxChainLength=currentChainLength;      //till now as we have only access to the current blockchain thus we assume maxchainlength equal to current chain length
    let newLongestChain=null;     //after we loop through each node's blockchain if we find any node's chain length to be longest than that of maxchainlength then we will update this value
    let newPendingTransactions=null;
    blockchains.forEach(blockchain=>{        //iterating through blockchain of every nodes
      if(blockchain.chain.length>maxChainLength)
      {
        maxChainLength=blockchain.chain.length;
        newLongestChain=blockchain.chain;
        newPendingTransactions=blockchain.pendingTransactions;  //if we find a new longest chain then it updates the pending transactions of whole network with the pending transactions of the longest chain
      };
   });//if there is no longest chain OR if if it is but not a valid chain
    if(!newLongestChain || (newLongestChain && !AlphaCoin.chainIsValid(newLongestChain)))
    {	console.log(AlphaCoin.chainIsValid(newLongestChain));
      res.json({Note:"Your copy of AlphaCoin blockchain is Valid thus it has not been Replaced"});
    }
        //if there is a longest chain && it is valid 
    else if(newLongestChain && AlphaCoin.chainIsValid(newLongestChain))
    {
      AlphaCoin.chain=newLongestChain;  //whole blockchain for whole network is replaced by longest chain
      AlphaCoin.pendingTransactions=newPendingTransactions;   //pending trx of whole network will also be replaced
      res.json({
                Note:"Your copy of AlphaCoin blockchain is NOT VALID thus it has been Replaced with the New Chain",
                NewChain:AlphaCoin.chain
              });
    }
  });
});

//BLOCK EXPLORER
//for searching by blockhashorindex
app.get("/block/:blockHashOrIndex",function (req,res){ // http://localhost:3001/block/0000aa81a72bf2eff291ca442827e9cff7a77dd02a7f988edf3c96742218103e(or 1,2,3)
const blockHashOrIndex=req.params.blockHashOrIndex;   //we could access anything passed as /:xyz by req.params.xyz
const blockFound=AlphaCoin.getHashOrIndex(blockHashOrIndex); //invoking function getHashOrIndex by passing searched blockHashorindex and saving the returned blockFound from it
res.json({Block: blockFound});
});


//for searching by transactionID
app.get("/transaction/:transactionId",function (req,res){  // http://localhost:3001/transaction/eef7716093ce11e8a5d74fd30518dfe8
const transactionId=req.params.transactionId;
const transactionData=AlphaCoin.getTransaction(transactionId); //invoking function getTransaction by passing searched transactionId and saving the returned transaction and block from it
res.json({Transaction: transactionData.Transaction, 
          Block:transactionData.Block});  //shows the matched trx along with its container block
});



//for searching by address of sender or recipient
app.get("/address/:address",function (req,res){
const address=req.params.address;
const addressData=AlphaCoin.getAddressData(address);
res.json({Transactions:addressData.addressTransactions,
          NetBalance:addressData.addressBalance});

});



//Block Explorer front end
app.get("/blockexplorer",function (req,res)
{ //sending a file by its directory             it says that look into current directory and find the path of file we sent here(./blockexplorer/explorer.html)    
  res.sendFile("./blockexplorer/explorer.html",{root: __dirname});
});


app.listen(port,function(){
	console.log(`Server ${port} is Running`);
}); 	//localhost


