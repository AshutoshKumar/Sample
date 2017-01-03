// var unique = require('uniq');
//
// var data = [1, 2, 2, 3, 4, 5, 5, 5, 6];
//
// console.log(unique(data));

// var $ = require('jquery');
// $('body').append('<p>Hello Browserify!</p>');

var fetch = require('isomorphic-fetch');

fetch('http://offline-news-api.herokuapp.com/stories')
    .then(function(response) {
        if (response.status >= 400) {
            throw new Error("Bad response from server");
        }
        return response.json();
    })
    .then(function(stories) {
        console.log(JSON.stringify(stories));
    });
