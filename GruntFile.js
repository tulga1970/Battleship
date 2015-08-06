module.exports = function(grunt) {
    grunt.initConfig({
        concat: {
            js: {
                src: ['public/old/js/battleship.js', 'public/old/js/**/*.js'],
                dest: 'public/old/build/js/main.js',
            },
            css: {
                src: ['public/old/css/**/*.css'],
                dest: 'public/old/build/css/main.css'
            }
        },
        watch: {
            js: {
                files: ['public/old/js/**/*.js'],
                tasks: ['concat:js'],
            },
            css: {
                files: ['public/old/css/**/*.css'],
                tasks: ['concat:css']
            }
        },
    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.registerTask('default', ['concat', 'watch']);
};