const express = require('express')
const http = require('http')
const app = express()
const { handler } = require('./src/updateIssue')

http.createServer(app).listen('6000', function () {
  console.log('Listening on 6000')
})

app.post('*', function (req, res) {
  handler(req)
})
