var sha256 = require("sha256");	//produce a 32 byte (256bits)unique hash
const uuid=require("uuid/v1");	//for randomly generating a alphanumeric string 
const port=process.env.port||3001;
const currentNodeUrl="http://localhost:"+port;	//url of current node we are fetching port from what we are entering in node eg:port=3002 npm start =>http://localhost:3002 & if we dont pass any port eg.npm start =>http://localhost:3001
const sizeof = require('object-sizeof');
const MineRate=10000;	//10000ms = 10s eg.10min in case of blockchain
const Wallet=require("./wallet"); 
function Blockchain(){
	this.chain=[];    //stores all block that are mined
	this.pendingTransactions=[];    //all new trx before they are accepted in block(initially none)
	this.currentNodeUrl=currentNodeUrl; 
	this.networkNodes=[]; //array of all nodes url
	const genesisblockreward=50; 
	const genesis =new Wallet();  
	this.allWallets(genesis.firstWallet());
	const recipient=genesis.firstWallet.PublicAddress;
	let newTransactions=this.createNewTransaction(genesisblockreward,recipient,"Block Reward","Unable to decode address (Newly generated Coin)",undefined,"c7b159009f0d11e8a5632d578008c299",1534174925600); 
	this.addTransactionToPendingTransaction(newTransactions); 
	let genesisblockdata=
	{
	 Index:1,
	 Transactions:newTransactions
	};
	const genesisNonce=this.proofOfWork(null,genesisblockdata,1);
	const genesisHash =this.hashBlock(null,genesisblockdata,genesisNonce);
	this.createNewBlock(genesisNonce,"0000000000000000000000000000000000000000000000000000000000000000",genesisHash,null,0,"Creator of this Blockchain",genesisblockreward,1,1534174216848);	//Genesis block
	this.updateWallet(genesis.firstWallet(),newTransactions,genesisblockreward,0);
}

Blockchain.prototype.createNewBlock= function(nonce,previousBlockHash,hash,nextblockhash,mineTime,miner,blockreward,difficulty,timestamp)
{	var self=this;
	const newBlock=
	{	
		Index:self.chain.length+1,	//current block no.(starting our counting from one)
		Timestamp:timestamp||Date.now(),
		Transactions: self.pendingTransactions,	//all pending new trx that are waiting to be mined
		Nonce: nonce,
		Hash:hash,	//hash of all new trx
		NextBlockHash:nextblockhash,
		PreviousBlockHash: previousBlockHash,
		Size_kB:(sizeof(this))/1024,		//here this represents current BLock
		HashedBy:miner,		//port  of the block miner
		TransactionVolume:(function a(){		//Total no. of trx happened in the block
										var y=0;
										for(var i=0;i<self.pendingTransactions.length;i++)
										{
                                            y=y+self.pendingTransactions[i].EstimatedAmountTransacted;
                                        } return y}())+" AlphaCoins",
		NumberOfTransactions:self.pendingTransactions.length,
		BlockReward:blockreward,
		Difficulty:difficulty, 	//difficulty starting from 1 hash should start with no. of zeroes as mentioned in difficulty
		BlockMiningTime:`${mineTime/1000} seconds`,	//time took to mine this block after the previous block
	};
	self.pendingTransactions=[];	//as after the newblock is made all previous new trx are stored thus we again make this empty so that incoming trx could be stored here till the next block is mined
	self.chain.push(newBlock);	//adding the new to chain
	return newBlock;
};

Blockchain.prototype.getLastBlock= function() 
{
	return this.chain[this.chain.length-1]; //it returns the last block when called
};

Blockchain.prototype.createNewTransaction= function(amount,recipient,note,senderaddress,fees,trxid,timestamp) 
{ 
	const newTransactions=
	{	Note:note,
		Timestamp:timestamp||Date.now(),
		TransactionId:trxid||uuid().split("-").join(""), 	//as the random string is of type (SDS89H-HF99F-H9F89)
		Sender:senderaddress,
		Recipient:recipient,
		Fees:fees,
		EstimatedAmountTransacted:amount,
	};
	return newTransactions;	
};


Blockchain.prototype.addTransactionToPendingTransaction= function(transacionObj) 
{
	this.pendingTransactions.push(transacionObj);	//summary:(old trx would be added in next mined block)detailed:adding these all pending trx as array to the pendingTransactions in function Blockchain which in result update the value of Transactions in createNextBlock(when the new block is mined) again after which pendingTransactions would become an empty array & this loop will go on ;iF SUPPOSE	many trx happened before a single block could be mined then also all trx combined would be waiting for the block to be mined. 
	return;
};


//calculate allpendingtransactionfees which would be given to the next block miner along with block reward
Blockchain.prototype.allpendingtransactionfees= function() 
{	var y=0;
    for(var i=0;i<this.pendingTransactions.length;i++)
      	{
          y=y+this.pendingTransactions[i].Fees;
        } 
     return y;
};

//Wallets is collection of all wallet's data(address,trx,balance) linked with the blockchain
var Wallets=[];	//array of all block reward trx


Blockchain.prototype.allWallets=function(walletdata)
{   
	Wallets.push(walletdata);
	return Wallets;
};

Blockchain.prototype.searchWallet=function(senderaddress,recipientaddress)
{  
	let senderWallet=null;
	let recipientWallet=null;
	Wallets.forEach(wallet=>		
	{
		if(wallet.PublicAddress===senderaddress)	
		{	 
			senderWallet=wallet;
		}
		if(recipientaddress && wallet.PublicAddress===recipientaddress)	
		{	 
			recipientWallet=wallet;
		}
	});
	return{senderWallet:senderWallet,
		   recipientWallet:recipientWallet
		  };
};

Blockchain.prototype.updateWallet=function(recipientWallet,newTransactions,amount,fees,senderWallet)
{   
	if(senderWallet)
	{
	senderWallet.Transactions.push(newTransactions);
	senderWallet.Balance-=(amount+fees);
	}
	if(recipientWallet!==null)
	{
	recipientWallet.Transactions.push(newTransactions);
 	recipientWallet.Balance+=(amount);
	};
 	return;
 };

Blockchain.prototype.proofOfWork= function(previousBlockHash,currentblockdata,difficulty)
{	
	let nonce=0;//repeatedly hash block by incrementing the nonce by one(starting from 0)until it finds the correct hash which starts with 0000XXXXXXXXXXXXXXXX(4 0's=>Difficulty)
	let Hash=this.hashBlock(previousBlockHash,currentblockdata,nonce);
	while(Hash.substring(0,difficulty)!=='0'.repeat(difficulty)) //to check first x digits where x is determined based on the difficulty
		{
		  nonce++;
		  Hash=this.hashBlock(previousBlockHash,currentblockdata,nonce);	//uses currentblockdata & previous block hash but as these values remains constant thus only nonce could be altered to generate target hash
		}
	return nonce;	//returns the nonce value that creates the correct hash
					//we do bcoz doing this (hashing again & again bt trying differnt value of nonce requires enormous computation power & thus a hacker needs to do enormous computaion if he wants to change any data in any block)
};



Blockchain.prototype.hashBlock= function(previousBlockHash,currentblockdata,nonce) 
{
	const dataAsString=(previousBlockHash+JSON.stringify(currentblockdata)+nonce.toString());	//converting all data to string(to make everything of similar data type) and concatinating it
	const Hash=sha256(dataAsString); 	//using sha256 generator
	return Hash;
};



//for adjusting block mining difficulty based on previous block difficulty and mine rate 
Blockchain.prototype.adjustDifficulty= function(previousDifficulty,lastBlockTime)
{//if the new block is mined less the mine rate from preious block then increase the difficulty by 1 if the new block is mined more than the mine rate from its previous block then dec difficulty by -1
	difficulty=lastBlockTime+MineRate>Date.now()?previousDifficulty+1:previousDifficulty-1;
	if(difficulty<=0)
	{
		difficulty=1;
	}
	return difficulty;
};


//for consensus algorithm
Blockchain.prototype.chainIsValid= function(blockchain)
{	let validChain=true;			//we let assume that our chain is valid
	for(var i=1;i<blockchain.length;i++)	//starting from posn 1 & skipping genesis block
	{
		const currentBlock=blockchain[i];
		const prevBlock=blockchain[i-1];//previousblock hash,currentblock data(same as passed during /mine)				 nonce
		const blockHash=this.hashBlock(prevBlock.Hash,{ Index:currentBlock.Index,Transactions:currentBlock.Transactions},currentBlock.Nonce);	//validating blockchain by re-hashing each block and ensuring that the hash starts with 0000
		let difficulty=currentBlock.Difficulty;
		if(currentBlock.PreviousBlockHash!==prevBlock.Hash || blockHash.substring(0,difficulty)!=='0'.repeat(difficulty) ||currentBlock.NumberOfTransactions===0 ||blockHash!==currentBlock.Hash)		//chain not valid
		{
			validChain=false;
		}
	};
	const genesisBlock=blockchain[0];
	if(genesisBlock.Nonce!==Blockchain.genesisNonce || genesisBlock.Hash!==Blockchain.genesisHash || genesisBlock.PreviousBlockHash!=="0000000000000000000000000000000000000000000000000000000000000000" || genesisBlock.Transactions.length!==0 ||genesisBlock.BlockReward!==50||genesisBlock.Difficulty!==1||genesisBlock.Timestamp!==1534174216848)		//checking whether the pre defined value of genesis block doesn't gets changed
	{
		validChain=false;
	}
	return validChain;
}


//this returns the block whose hash or index matches the hash or index searched in blockexplorer
Blockchain.prototype.getHashOrIndex= function(blockHashOrIndex) //passing the searched blockHashor index from the block explorer
{
	let blockFound=null;			//as blockFound by default is set to null so if the searched hashor index doesn't matches with any of the blockchain's hashor index it will return null
	this.chain.forEach(block=>{		//iterate through each block in the chain
	if(block.Hash===blockHashOrIndex||block.Index==blockHashOrIndex)
	{
		blockFound=block;
	}
});
return blockFound;		//returns the block whose hashor index matches the searched hashor index in block explorer
};


//this returns the transaction whose transaction id matches the trx id searched from blockexplorer
Blockchain.prototype.getTransaction= function(transactionId) //passing the searched transaction ID from the block explorer
{	let transactionFound=null;			//as transactionFound by default is set to null so if the searched trx id doesn't matches with any of the blockchain's trx it will return null
	let blockFound=null;
	this.chain.forEach(block=>		//iterate through each block in the chain
	{
		block.Transactions.forEach(transaction=>		//also iterate through every trx inside a block
		{	 
			if(transaction.TransactionId===transactionId)
				{
				transactionFound=transaction;
				blockFound=block;
				}
		});
	});
	return {
			Transaction :transactionFound,//returns the transaction whose trx id matches the searched trx id in block explorer
			Block :blockFound//returns the block in which the above trx is found 
		   };
};


//this returns all the trx associated with the address searched in blockexplorer and put them in single array
Blockchain.prototype.getAddressData= function(address) //passing the searched public address from the block explorer
{	let addressTransactions=null;
	let addressBalance=null;
	Wallets.forEach(wallet=>		
	{
		if(wallet.PublicAddress===address)	
		{	
	 		addressTransactions=wallet.Transactions,
	 		addressBalance=wallet.Balance
		}
	});
		return{
	 		addressTransactions:addressTransactions,
	 		addressBalance:addressBalance,
			};

};



module.exports=Blockchain;	//constructor function name (part of the file we want to export)
