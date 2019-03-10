# AlphaCoin-Blockchain
A unique blockchian similar to that of bitcoin

## Features:
```
1.Mine block block reward(starting from 50 Alphacoins and would be halved after every 10th blockblock reward(starting from 50 Alphacoins and would be halved after every 10th block mined)

2.Parameters of the block are:Indec,Timestamp,All Transactions incled in the block,Nonce,Block Hash ,Previous block hash,Size of the block,Details of the Miner of the block,Block Transaction volume,Blockreward ,BlockMining time,BlockDifficulty

3.Parameters of the whole blockchain:Block,Pending Transactions Pool,Current Node address,Node Addresses of whole network.

4.Wallet could be generated whose parameters are:Public address,privateKey,Balance,Public Key.

5.Wallet private key is not stored on the server but only its hash so no hack possible.

6.Transactions Could also take place between addresses 

7.NO Double spending could take place

8.All transactions are secured via signature of the private key of the recepient.

9.BlockExplorer UI for searching block by its index,address for its balance,transactionId for the details of a particular transaction.

```
## Instructions
```
npm install

npm start

check at localhost:3001/

for connecting more node run port=3002 npm start in other terminal
                         run port=3003 npm start....
                         
So now everyone is running there own copy of blockchain but with same genesis block at there respective server

To make a distributed mesh network push a post request from any server to connect with other via postman

  eg: Post request of-:http://localhost:3001/register-and-broadcast-node
  
                    and pass this as json:- {
                    
	                              "newNodeUrl":"http://localhost:3002"
                                
                              }
                              
                    and again {
                    
                              	"newNodeUrl":"http://localhost:3003"
                                
                               }
                               
now all three are interconnected and thus now all are distributed network

To generate a wallet http://localhost:3001/generatewallet to generate a PubAddress,Pub-Priv Key,Balance of 100 Alphacoins

Now to Mine the Block push a post request from the server who wants to mine the block
  
  eg: Post request of-:http://localhost:3003/mine
                  
                  and pass this as json:-{ 
                                          
                                          "PublicAddress": "1f4da15f2a4ec3462fe63d1bd3d03d37662098d22"   
                                          
                                          } (note that it should be the same public key that you have generated in previous step)
        
        after which you will successfully mine the block and it would be broadcasted to each node that you are connected with
         also the miner will be rewarded with the block reward(starting from 50 Alphacoins and would be halved after every 10th block)  and the transaction fees of all pending transactions.

Any new node connected on the alphacoin blockchain will receive the full copy of the blockchain based on the longest and valid blocks and there transaction on the blockchain by a get request via http://localhost:3004/consensus 

/transactions/broadcast
