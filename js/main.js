$(function() {
    var Job = Backbone.Model.extend({
        idAttribute: 'name',
        initialize: function() {
            this.set('displayName', this.displayName());
            this.on('change:name', function() {
                this.set('displayName', this.displayName());
            }, this);
        },
        displayName: function() {
            return this.get('name').replace(/_/g, ' ');
        },
        realDuration: function() {
            return Date.now() - this.get('lastBuild').timestamp;
        }
    });

    var JobsList = Backbone.Collection.extend({
        model: Job,
        url: window.jenky.conf.jenkins.url + '/api/json?tree=jobs[name,color,lastBuild[building,timestamp,estimatedDuration]]',
        parse: function(response) {
            console.log(response);
            return response.jobs;
        },
        sync: function(method, model, options) {
            if (method === "read") {
                $.ajax({
                    url: this.url,
                    dataType: 'jsonp',
                    jsonp: 'jsonp'
                }).then(_.bind(function(data) {
                    var jobs = this.parse(data);

                    _.forEach(jobs, function(job) {
                        var existing = this.get(job.name);

                        if (_.isUndefined(existing)) {
                            this.add(job);
                        } else {
                            existing.set(job);
                        }
                    }, this);
                }, this));
            }
        }
    });

    var jobs = window.jenky.jobs = new JobsList();

    var JobView = Backbone.View.extend({
        tagName: "li",
        template: _.template($('#job-template').html()),
        initialize: function() {
            this.model.on('change', this.render, this);
            this.model.on('destroy', this.remove, this);
        },
        render: function() {
            var attributes = this.model.toJSON();
            _.extend(attributes, {
                previousColor: this.model.previousAttributes.color
            });
            this.$el.html(this.template(attributes));
            this.showProgress();
            return this;
        },
        showProgress: function() {
            var progressElement = this.$el.find('.progress');

            if (progressElement.length === 0)
                return;

            var main = progressElement.prev();

            var progress = this.model.realDuration();
            var duration = this.model.get('lastBuild').estimatedDuration;
            var p = progress / duration;

            progressElement.css({
                width: '' + Math.round(p * main.width()) + 'px'
            });
        }
    });

    var JenkyView = Backbone.View.extend({
        el: $('#jobs'),
        initialize: function() {
            jobs.on('add', this.addOne, this);
            jobs.on('reset', this.addAll, this);
            jobs.on('all', this.render, this);
            $(window).resize(_.throttle(_.bind(this.render, this), 200));
        },
        render: function() {
            var windowHeight = $(window).height();

            var topMargin = 50;
            var leftMargin = 40;

            var containerHeight = windowHeight - topMargin;

            this.$el.css({
                height: containerHeight + 'px',
                top: topMargin + 'px',
                left: leftMargin + 'px'
            });

            var items = this.$el.find('li');
            var height = Math.floor(containerHeight / Math.ceil(items.length / 2));

            items.css({
                height: height
            });
        },
        addOne: function(job) {
            var view = new JobView({model: job});
            view.$el.appendTo(this.$el);
            view.render();
        },
        addAll: function() {
            this.$el.empty();
            jobs.each(_.bind(this.addOne, this));

        },
        update: function() {
            jobs.fetch();
            _.delay(_.bind(this.update, this), window.jenky.conf.jenkins.updateInterval);
        }
    });

    var app = window.jenky.app = new JenkyView();

    $('body').css({
        'font-family': window.jenky.conf.jenky.font
    });

    app.update();
});