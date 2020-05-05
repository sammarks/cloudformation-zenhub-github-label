const express = require('express')
const http = require('http')
const bodyParser = require('body-parser')
const app = express()
const { handler } = require('./src/updateIssue')

http.createServer(app).listen('6000', function () {
  console.log('Listening on 6000')
})

app.use(bodyParser())

app.post('*', function (req, res) {
  handler({
    body: JSON.stringify(req.body)
  })
})
