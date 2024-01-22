const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()
app.use(express.json())
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'twitterClone.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const checkuser = `select username from user where name='${name}'`
  const dbuser = await db.get(checkuser)
  if (dbuser === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedpassword = bcrypt.hash(password, 10)
      const insertuser = `insert into user(username,password,name,gender) values('${username}','${hashedpassword}','${name}','${gender}')`
      await db.run(insertuser)
      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const checkuser = `select * from user where username='${username}'`
  const dbuser = await db.get(checkuser)
  if (dbuser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const ispassword = await bcrypt.compare(password, dbuser.password)
    if (ispassword === false) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'my_sign')
      response.send({jwtToken})
    }
  }
})
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const usersquery = `select distinct following_user_id from follower`
  const user_id = await db.all(usersquery)
  const tweetquery = `select username,tweet,date_time from user inner join tweet on user.user_id=tweet.user_id order by date_time desc limit 4`
  const tweets = await db.all(tweetquery)
  response.send(tweets)
})
module.exports = app
