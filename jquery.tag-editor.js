"use strict";

(function($){
    // plugin with val as parameter for public methods
    $.fn.tagEditor = function(options, val, blur) {

        // helper
        function escape(tag) {
            return tag.replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;')
                      .replace(/'/g, '&#39;');
        }

        function validate(tag) {
            try {
                var parsedTag = typeof tag === 'string' ? JSON.parse(tag) : tag;

                if (parsedTag.hasOwnProperty('tagValue') && typeof parsedTag.tagValue === 'string' && parsedTag.tagValue.trim().length > 0) {
                    return parsedTag;
                }
            } catch (e) {}

            return String(tag).trim().length > 0 ? {tagValue: String(tag).trim()} : false;
        }

        // build options dictionary with default values
        var blur_result,
            o = $.extend({}, $.fn.tagEditor.defaults, options),
            selector = this;

        // store regex and default delimiter in options for later use
        o.dregex = new RegExp('[' + o.delimiter.replace('-', '\-') + ']', 'g');

        // public methods
        if (typeof options === 'string') {
            // depending on selector, response may contain tag lists of multiple editor instances
            var response = [];
            selector.each(function() {
                // the editor is the next sibling to the hidden, original field
                var el = $(this),
                    o = el.data('options'),
                    ed = el.next('.tag-editor');

                if (options === 'getTags') {
                    response.push({field: el[0], editor: ed, tags: ed.data('tags')});
                }
                else if (options === 'addTag') {
                    if (o.maxTags && ed.data('tags').length >= o.maxTags) {
                        return false;
                    }

                    var validTag = validate(val);
                    if (validTag) {
                        var $input = $('<input type="text" maxlength="' + o.maxLength + '">'),
                            tagKeys = Object.keys(validTag);

                        // Populate <input> with the tag data
                        for (var i = 0 ; i < tagKeys.length ; i++) {
                            if (tagKeys[i] !== 'tagValue') {
                                $input[0].dataset[tagKeys[i]] = validTag[tagKeys[i]];
                            }
                        }

                        // The <input> will be replaced with its value in L412 if it has no delimiters or in L341 if it does
                        $('<li></li>')
                            .append('<div class="tag-editor-spacer">&nbsp;' + o.delimiter[0] + '</div>')
                            .append('<div class="tag-editor-tag"></div>')
                            .append('<div class="tag-editor-delete"><i></i></div>')
                        .appendTo(ed).find('.tag-editor-tag')
                        .append($input).addClass('active').find('input').val(validTag.tagValue).blur();


                        if (!blur) {
                            ed.click();
                        }
                        else {
                            $('.placeholder', ed).remove();
                        }
                    }
                }
                else if (options === 'removeTag') {
                    // trigger delete on matching tag, then click editor to create a new tag
                    $('.tag-editor-tag', ed).filter(function() {
                        return $(this).text() === val;
                    }).closest('li').find('.tag-editor-delete').click();

                    if (!blur){
                        ed.click();
                    }
                }
                else if (options === 'destroy') {
                    el.removeClass('tag-editor-hidden-src').removeData('options').off('focus.tag-editor').next('.tag-editor').remove();
                }
            });

            return options === 'getTags' ? response : this;
        }

        // delete selected tags on backspace, delete
        if (window.getSelection) {
            $(document).off('keydown.tag-editor').on('keydown.tag-editor', function(e) {
                if (e.which === 8 || e.which === 46) {
                    try {
                        var sel = getSelection(), el = document.activeElement.tagName === 'BODY' ? $(sel.getRangeAt(0).startContainer.parentNode).closest('.tag-editor') : 0;
                    }
                    catch(e) {
                        el = 0;
                    }

                    if (sel.rangeCount > 0 && el && el.length) {
                        var tags = [],
                            splits = sel.toString().split(el.prev().data('options').dregex);

                        for (var i = 0 ; i < splits.length ; i++) {
                            var tag = $.trim(splits[i]);
                            if (tag) {
                                tags.push(tag);
                            }
                        }
                        $('.tag-editor-tag', el).each(function() {
                            if ($.inArray($(this).text(), tags) >= 0) {
                                $(this).closest('li').find('.tag-editor-delete').click();
                            }
                        });

                        return false;
                    }
                }
            });
        }

        // Create a tagEditor for each of the matched elements (usually an <input type='text'> or a <textarea>)
        return selector.each(function() {
            var el = $(this),
                tag_list = []; // Cache current tags

            // Create editor (ed) instance: el -> $<textarea>, ed -> $<ul>
            var ed = $('<ul ' + (o.clickDelete ? 'oncontextmenu="return false;" ' : '') + 'class="tag-editor"></ul>').insertAfter(el);

            el.addClass('tag-editor-hidden-src') // Hide original field
                .data('options', o) // Set data on hidden field
                .on('focus.tag-editor', function() { ed.click(); }); // Simulate tabindex

            // Add dummy item for min-height on empty editor
            ed.append('<li style="width:1px">&nbsp;</li>');

            // Markup for new tag
            var new_tag =
                '<li>' +
                    '<div class="tag-editor-spacer">&nbsp;' + o.delimiter[0] + '</div>' +
                    '<div class="tag-editor-tag"></div>' +
                    '<div class="tag-editor-delete"><i></i></div>' +
                '</li>';

            // Helper: update global data
            function set_placeholder() {
                if (o.placeholder && !tag_list.length && !$('.deleted, .placeholder, input', ed).length) {
                    ed.append('<li class="placeholder"><div>' + o.placeholder + '</div></li>');
                }
            }

            // Helper: update global data
            function update_globals(init) {
                var old_tags = tag_list.toString();

                tag_list = $('.tag-editor-tag:not(.deleted)', ed).map(function(i, e) {
                    var val = $.trim($(this).hasClass('active') ? $(this).find('input').val() : $(e).text());
                    if (val) {
                        return val;
                    }
                }).get();

                ed.data('tags', tag_list);
                el.val(tag_list.join(o.delimiter[0]));

                // Change callback except for plugin init
                if (!init) {
                    if (old_tags != tag_list.toString()) {
                        o.onChange(el, ed, tag_list);
                    }
                }
                set_placeholder();
            }

            ed.click(function(e, closest_tag) {
                var d, dist = 99999, loc;

                // Do not create tag when user selects tags by text selection
                if (window.getSelection && getSelection() != '') {
                    return;
                }

                if (o.maxTags && ed.data('tags').length >= o.maxTags) {
                    ed.find('input').blur(); return false;
                }

                blur_result = true;
                $('input:focus', ed).blur();
                if (!blur_result) {
                    return false;
                }
                blur_result = true;

                // always remove placeholder on click
                $('.placeholder', ed).remove();
                if (closest_tag && closest_tag.length) {
                    loc = 'before';
                }
                else {
                    // calculate tag closest to click position
                    $('.tag-editor-tag', ed).each(function() {
                        var tag = $(this),
                            to = tag.offset(),
                            tag_x = to.left,
                            tag_y = to.top;

                        if (e.pageY >= tag_y && e.pageY <= tag_y+tag.height()) {
                            if (e.pageX < tag_x) {
                                loc = 'before', d = tag_x - e.pageX;
                            }
                            else {
                                loc = 'after', d = e.pageX - tag_x - tag.width();
                            }
                            if (d < dist) dist = d, closest_tag = tag;
                        }
                    });
                }

                if (loc === 'before') {
                    $(new_tag).insertBefore(closest_tag.closest('li')).find('.tag-editor-tag').click();
                }
                else if (loc === 'after') {
                    $(new_tag).insertAfter(closest_tag.closest('li')).find('.tag-editor-tag').click();
                }
                else { // empty editor
                    $(new_tag).appendTo(ed).find('.tag-editor-tag').click();
                }
                return false;
            });

            ed.on('click', '.tag-editor-delete', function(e) {
                // Delete icon is hidden when input is visible; place cursor near invisible delete icon on click
                if ($(this).prev().hasClass('active')) {
                    $(this).closest('li').find('input').caret(-1); return false;
                }

                var li = $(this).closest('li'),
                    tag = li.find('.tag-editor-tag');

                if (o.beforeTagDelete(el, ed, tag_list, tag.text()) === false) {
                    return false;
                }

                tag.addClass('deleted').animate({width: 0}, o.animateDelete, function() { li.remove(); set_placeholder(); });
                update_globals();
                return false;
            });

            // Delete on right mouse click or ctrl+click
            if (o.clickDelete) {
                ed.on('mousedown', '.tag-editor-tag', function (e) {
                    if (e.ctrlKey || e.which > 1) {
                        var li = $(this).closest('li'),
                            tag = li.find('.tag-editor-tag');

                        if (o.beforeTagDelete(el, ed, tag_list, tag.text()) === false) {
                            return false;
                        }

                        tag.addClass('deleted').animate({width: 0}, o.animateDelete, function () {
                            li.remove();
                            set_placeholder();
                        });

                        update_globals();
                        return false;
                    }
                });
            }

            ed.on('click', '.tag-editor-tag', function(e) {
                // Delete on right click or ctrl+click -> exit
                if (o.clickDelete && (e.ctrlKey || e.which > 1)) {
                    return false;
                }

                if (!$(this).hasClass('active')) {
                    var tag = $(this).text();
                    // guess cursor position in text input
                    var left_percent = Math.abs(($(this).offset().left - e.pageX)/$(this).width()),
                        caret_pos = parseInt(tag.length*left_percent),
                        input = $(this).html('<input type="text" maxlength="'+o.maxLength+'" value="'+escape(tag)+'">').addClass('active').find('input');

                        input.data('old_tag', tag).focus().caret(caret_pos);

                    if (o.autocomplete) {
                        var aco = $.extend({}, o.autocomplete);
                        // Extend user provided autocomplete select method
                        var ac_select = 'select' in aco ? o.autocomplete.select : '';

                        aco.select = function(e, ui) {
                            if (ac_select) {
                                ac_select(e, ui);
                            }

                            setTimeout(function() {
                                ed.trigger('click', [$('.active', ed).find('input').closest('li').next('li').find('.tag-editor-tag')]);
                            }, 20);
                        };
                        input.autocomplete(aco);
                        if (aco._renderItem) {
                            input.autocomplete('instance')._renderItem = aco._renderItem;
                        }
                    }
                }
                return false;
            });

            // helper: split into multiple tags, e.g. after paste
            function split_cleanup(input) {
                var li = input.closest('li'),
                    sub_tags = input.val().replace(/ +/, ' ').split(o.dregex),
                    old_tag = input.data('old_tag'),
                    old_tags = tag_list.slice(0),
                    exceeded = false,
                    cb_val; // copy tag_list

                for (var i = 0 ; i < sub_tags.length ; i++) {
                    tag = $.trim(sub_tags[i]).slice(0, o.maxLength);
                    if (o.forceLowercase) {
                        tag = tag.toLowerCase();
                    }

                    cb_val = o.beforeTagSave(el, ed, old_tags, old_tag, tag);
                    tag = cb_val || tag;

                    if (cb_val === false || !tag) {
                        continue;
                    }

                    var escapedTag = escape(tag);
                    var $tagEditorTag = $('<div class="tag-editor-tag">' + escapedTag + '</div>');
                    Object.assign($tagEditorTag.get(0).dataset, input.get(0).dataset);
                    $tagEditorTag.get(0).dataset.tagValue = escapedTag;

                    old_tags.push(tag);
                    li.before(
                        $('<li></li>')
                            .append('<div class="tag-editor-spacer">&nbsp;' + o.delimiter[0] + '</div>')
                            .append($tagEditorTag)
                            .append('<div class="tag-editor-delete"><i></i></div>')
                    );

                    if (o.maxTags && old_tags.length >= o.maxTags) {
                        exceeded = true;
                        break;
                    }
                }

                input.dataset = {};
                input.attr('maxlength', o.maxLength).removeData('old_tag').val('');

                if (exceeded) {
                    input.blur();
                }
                else {
                    input.focus();
                }

                update_globals();
            }

            ed.on('blur', 'input', function(e) {
                e.stopPropagation();

                var input = $(this),
                    old_tag = input.data('old_tag'),
                    tag = $.trim(input.val().replace(/ +/, ' ').replace(o.dregex, o.delimiter[0]));

                if (!tag) {
                    if (old_tag && o.beforeTagDelete(el, ed, tag_list, old_tag) === false) {
                        input.val(old_tag).focus();
                        blur_result = false;
                        update_globals();
                        return;
                    }
                    try { input.closest('li').remove(); } catch(e){}
                    if (old_tag) update_globals();
                }
                else if (tag.indexOf(o.delimiter[0]) >= 0) {
                    split_cleanup(input);
                    return;
                }
                else if (tag != old_tag) {
                    if (o.forceLowercase) {
                        tag = tag.toLowerCase();
                    }

                    var cb_val = o.beforeTagSave(el, ed, tag_list, old_tag, tag);
                    tag = cb_val || tag;
                    if (cb_val === false) {
                        if (old_tag) {
                            input.val(old_tag).focus();
                            blur_result = false;
                            update_globals();
                            return;
                        }
                        try { input.closest('li').remove(); } catch(e){}

                        if (old_tag) {
                            update_globals();
                        }
                    }
                }

                // Replace <input> with its escaped value. E.g.:
                // <div class="tag-editor-tag"><input value="tag < text"></div>  -->  <div class="tag-editor-tag">tag &lt; text</div>
                var escapedTag = escape(tag),
                    $tagEditorTag = input.parent();

                Object.assign($tagEditorTag.get(0).dataset, input.get(0).dataset);
                $tagEditorTag.get(0).dataset.tagValue = escapedTag;
                $tagEditorTag.html(escape(tag)).removeClass('active');

                if (tag != old_tag) {
                    update_globals();
                }

                set_placeholder();
            });

            var pasted_content;
            ed.on('paste', 'input', function(e) {
                $(this).removeAttr('maxlength');
                pasted_content = $(this);
                setTimeout(function() {
                    split_cleanup(pasted_content);
                }, 30);
            });

            // keypress delimiter
            var inp;
            ed.on('keypress', 'input', function(e) {
                if (o.delimiter.indexOf(String.fromCharCode(e.which)) >= 0) {
                    inp = $(this);
                    setTimeout(function() {
                        split_cleanup(inp);
                    }, 20);
                }
            });

            ed.on('keydown', 'input', function(e) {
                var $t = $(this);

                // left/up key + backspace key on empty field
                if ((e.which === 37 || !o.autocomplete && e.which === 38) && !$t.caret() || e.which === 8 && !$t.val()) {
                    var prev_tag = $t.closest('li').prev('li').find('.tag-editor-tag');

                    if (prev_tag.length) {
                        prev_tag.click().find('input').caret(-1);
                    }
                    else if ($t.val() && !(o.maxTags && ed.data('tags').length >= o.maxTags)) {
                        $(new_tag).insertBefore($t.closest('li')).find('.tag-editor-tag').click();
                    }

                    return false;
                }
                // right/down key
                else if ((e.which === 39 || !o.autocomplete && e.which === 40) && ($t.caret() === $t.val().length)) {
                    var next_tag = $t.closest('li').next('li').find('.tag-editor-tag');

                    if (next_tag.length) {
                        next_tag.click().find('input').caret(0);
                    }
                    else if ($t.val()) {
                        ed.click();
                    }

                    return false;
                }
                // tab key
                else if (e.which === 9) {
                    // shift+tab
                    if (e.shiftKey) {
                        var prev_tag = $t.closest('li').prev('li').find('.tag-editor-tag');

                        if (prev_tag.length) {
                            prev_tag.click().find('input').caret(0);
                        }
                        else if ($t.val() && !(o.maxTags && ed.data('tags').length >= o.maxTags)) {
                            $(new_tag).insertBefore($t.closest('li')).find('.tag-editor-tag').click();
                        }
                        else {  // Allow tabbing to previous element
                            el.attr('disabled', 'disabled');
                            setTimeout(function() {
                                el.removeAttr('disabled');
                            }, 30);
                            return;
                        }

                        return false;
                    // tab
                    } else {
                        var next_tag = $t.closest('li').next('li').find('.tag-editor-tag');

                        if (next_tag.length) {
                            next_tag.click().find('input').caret(0);
                        }
                        else if ($t.val()) {
                            ed.click();
                        }
                        else {  // Allow tabbing to next element
                            return;
                        }
                        return false;
                    }
                }
                // del key
                else if (e.which === 46 && (!$.trim($t.val()) || ($t.caret() === $t.val().length))) {
                    var next_tag = $t.closest('li').next('li').find('.tag-editor-tag');

                    if (next_tag.length) {
                        next_tag.click().find('input').caret(0);
                    }
                    else if ($t.val()) {
                        ed.click();
                    }

                    return false;
                }
                // enter key
                else if (e.which === 13) {
                    ed.trigger('click', [$t.closest('li').next('li').find('.tag-editor-tag')]);

                    // trigger blur if maxTags limit is reached
                    if (o.maxTags && ed.data('tags').length >= o.maxTags) {
                        ed.find('input').blur();
                    }

                    return false;
                }
                // pos1
                else if (e.which === 36 && !$t.caret()) {
                    ed.find('.tag-editor-tag').first().click();
                }
                // end
                else if (e.which === 35 && $t.caret() === $t.val().length) {
                    ed.find('.tag-editor-tag').last().click();
                }
                // esc
                else if (e.which === 27) {
                    $t.val($t.data('old_tag') ? $t.data('old_tag') : '').blur();
                    return false;
                }
            });

            // Create initial tags
            var tags = o.initialTags.length ? o.initialTags : el.val().split(o.dregex);

            for (var i = 0 ; i < tags.length ; i++) {
                if (o.maxTags && i >= o.maxTags) {
                    break;
                }

                var tag = $.trim(tags[i].replace(/ +/, ' '));

                if (tag) {
                    if (o.forceLowercase) {
                        tag = tag.toLowerCase();
                    }

                    tag_list.push(tag);
                    ed.append(
                        '<li>' +
                            '<div class="tag-editor-spacer">&nbsp;' + o.delimiter[0] + '</div>' +
                            '<div class="tag-editor-tag">' + escape(tag) + '</div>' +
                            '<div class="tag-editor-delete"><i></i></div>' +
                        '</li>');
                }
            }

            update_globals(true); // true -> no onChange callback

            // Init sortable
            if (o.sortable && $.fn.sortable) {
                ed.sortable({
                    distance: 5, cancel: '.tag-editor-spacer, input', helper: 'clone',
                    update: function(){ update_globals(); }
                });
            }
        });
    };

    $.fn.tagEditor.defaults = {
        initialTags: [],
        maxTags: 0,
        maxLength: 50,
        delimiter: ',;',
        placeholder: '',
        forceLowercase: true,
        // removeDuplicates: true,
        clickDelete: false,
        animateDelete: 175,
        sortable: true, // jQuery UI sortable
        autocomplete: null, // options dict for jQuery UI autocomplete

        // callbacks
        onChange: function(){},
        beforeTagSave: function(){},
        beforeTagDelete: function(){}
    };
}(jQuery));
