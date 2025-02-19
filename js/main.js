//First line of main.js... wrap everything in a self-executing anonymous function to move to local scope
(function(){
//pseudo-global variables
var attrArray = ["per_veterans", "per_nonveterans", "populationover18sqmiles", "per_males", "per_females", "per_gulfwar", "per_firstgulfwar", "per_vietnam", "per_korean", "per_wwii"];
var expressed = attrArray[0]; //initial attribute

var attrName = {
    populationover18sqmiles: "Population Over 18 Per Sq Miles",
    per_veterans: "% of Population that are Veterans",
    per_nonveterans: "% of Population that are Non Veterans",
    per_males: "% of Veterans that are Male",
    per_females: "% of Veterans that are Female",
    per_gulfwar: "% of Veterans from Gulf War (9/2001 or later)",
    per_firstgulfwar:"% of Veterans from Gulf War (8/1990 to 8/2001)",
    per_vietnam: "% of Veterans from Vietnam War",
    per_korean: "% of Veterans from Korean War",
    per_wwii: "% of Veterans from WWII",
}

//Chart frame dimensions
var chartWidth = window.innerWidth * 0.95,
chartHeight = window.innerHeight * 0.4245,
leftPadding = 25,
rightPadding = 2,
topBottomPadding = 5,
chartInnerWidth = chartWidth - leftPadding - rightPadding,
chartInnerHeight = chartHeight - topBottomPadding * 2,
translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//Create a scale to size bars proportionally to frame
var yScale = d3.scaleLinear()
    .range([400, 0])
    .domain([0, 14]);

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    //map frame dimensions
    var width = window.innerWidth * 0.95,
        height = 340;

    //Create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    var projection = d3.geoAlbersUsa()
        .scale(750)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //Use queue to parallelize asynch data loading
    d3.queue()
        .defer(d3.csv, "data/UpdatedVeteransData.csv")
        .defer(d3.json, "data/US_Outline.topojson")
        .await(callback);

    function callback(error, csvData, states){

        //translate States TopoJSONs
        var americanStates = topojson.feature(states, states.objects.US_Outline).features;

        //join csv data to GeoJSON enumeration units
        americanStates = joinData(americanStates, csvData);

        //Create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(americanStates, map, path, colorScale);

        //Add coordinated visualization to the map
        setChart(csvData, colorScale);

        createDropdown(csvData);
    };

}; //end of setMap()

//Function to create coordinated bar chart
function setChart(csvData, colorScale){
    //Create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //Create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    //Set bars for each province
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.adm1_code;
        })
        .attr("width", chartInnerWidth / csvData.length -1)
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);

    //Add style descriptor to each rect
    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');

    //Create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 60)
        .attr("y", 20)
        .attr("class", "chartTitle")
        //.text("Number of Variable " + expressed[3] + " in each region");

    //Create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    //Place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //Create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    updateChart(bars, csvData.length, colorScale);
};

function joinData(americanStates, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvRegion = csvData[i]; //the current region
        var csvKey = csvRegion.adm1_code; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<americanStates.length; a++){
            var geojsonProps = americanStates[a].properties;//the current region geojson properties
            var geojsonKey = geojsonProps.adm1_code;//the geojson primary key

            //Where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){
                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assing attribute and value to geojson properties
                });
            };
        };
    };
    return americanStates;
};

function setEnumerationUnits(americanStates, map, path, colorScale){
    var addStates = map.selectAll(".addStates")
        .data(americanStates)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "addStates " + d.properties.adm1_code;
        })
        .attr("d", path)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover", function(d){
            highlight(d.properties);
        })
        .on("mouseout", function(d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);

    //Add style descriptor to each path
    var desc = addStates.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    console.log(americanStates);
};

//Function to test for data value and return color
function choropleth(props, colorScale){
    //Make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //If attribute value exists, assign a color; otherwise assign a grey color
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else{
        return "#CCC"
    };
};

//Function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#EDF8E9",
        "#BAE4B3",
        "#74C476",
        "#31A354",
        "#006D2C"
    ];

    //Create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);

    //Build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //Assign array of expressed values as scale domain
    colorScale.domain(domainArray);

    return colorScale;
};

//Function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //Add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //Add initial opiton
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //Add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){return d})
        .text(function(d){return attrName[d]});
}

//Dropdown change listener handler
function changeAttribute(attribute, csvData){
    //Change the expressed attribute
    expressed = attribute;

    //Recreate the color scale
    var colorScale = makeColorScale(csvData);

    //Recolor enumeration units
    var addStates = d3.selectAll(".addStates")
        .transition()
        .duration(1000)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });

    //Max value for the selected attribute
    var max = d3.max(csvData, function(d){
        return + d[expressed];
    });

    if (expressed == attrArray[1]){
        yScale = d3.scaleLinear()
            .range([400, 0])
            .domain([0, max + 5]);
    } else if (expressed == attrArray[2]){
        yScale = d3.scaleLinear()
            .range([400, 0])
            .domain([0, max + 19]);
    } else if (expressed == attrArray[3]){
        yScale = d3.scaleLinear()
            .range([400, 0])
            .domain([0, max + 6]);
    } else if (expressed == attrArray[4]){
        yScale = d3.scaleLinear()
            .range([400, 0])
            .domain([0, max + 6]);
    } else if (expressed == attrArray[5]){
        yScale = d3.scaleLinear()
            .range([400, 0])
            .domain([0, max + 2]);
    } else if (expressed == attrArray[6]){
        yScale = d3.scaleLinear()
            .range([400, 0])
            .domain([0, max + 5]);
    } else if (expressed == attrArray[7]){
        yScale = d3.scaleLinear()
            .range([400, 0])
            .domain([0, max + 4]);
    } else if (expressed == attrArray[8]){
        yScale = d3.scaleLinear()
            .range([400, 0])
            .domain([0, max + 5]);
    } else if (expressed == attrArray[9]){
        yScale = d3.scaleLinear()
            .range([400, 0])
            .domain([0, max + 2]);
    } else{
        yScale = d3.scaleLinear()
            .range([400, 0])
            .domain([0, 14]);
    }

    //Reset yScale
    // yScale = d3.scaleLinear()
    //     .range(400, 0)
    //     .domain([0, max + 5]);

    //Resort, resize, and recolor bars
    var bars = d3.selectAll(".bar")
        //Re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition()//add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500)
        .attr("x", function(d, i){
            return i * (chartInnerWidth / csvData.length) + leftPadding;
        })
        //resize bars
        .attr("height", function(d, i){
            return 400 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });

    updateChart(bars, csvData.length, colorScale);
};

//Function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //Position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //Size and resize bars
        .attr("height", function(d, i){
            return 400 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //Color and recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale)
        });

    //Update the chart axis
    var yAxis = d3.axisLeft()
        .scale(yScale);

    d3.selectAll("g.axis")
        .call(yAxis);

    //Add text to chart title
    var chartTitle = d3.select(".chartTitle")
        .text(attrName[expressed] + " by State");
};

//Function to highlight enumeration units and bars
function highlight(props){
    //Change stroke
    var selected = d3.selectAll("." + props.adm1_code)
        .style("stroke", "#fec44f")
        .style("stroke-width", "3.5")
        setLabel(props);
};

//Function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.adm1_code)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };

    d3.select(".infolabel")
        .remove();
};

//Function to create dynamic labels
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] + "</h1><b>" + attrName[expressed] + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.adm1_code + "_label")
        .html(labelAttribute);

    var stateName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.name);
};

//Function to move info label with mouse
function moveLabel(){
    //Get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //Use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //Horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    //Vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1;

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
})();
