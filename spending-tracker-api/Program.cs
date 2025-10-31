using Microsoft.EntityFrameworkCore;
using SpendingTrackerApi.Data;
using SpendingTrackerApi.Methods;
using SpendingTrackerApi.Functions;
using Microsoft.AspNetCore.Http.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure JSON serialization
builder.Services.Configure<JsonOptions>(options =>
{
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    options.SerializerOptions.MaxDepth = 32;
});

// Configure SQLite
builder.Services.AddDbContext<SpendingDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configure CORS for React frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        builder => builder
            .WithOrigins("http://localhost:3000", "https://localhost:3000")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
});

// Register services
builder.Services.AddScoped<TransactionMethods>();
builder.Services.AddScoped<CategoryMethods>();
builder.Services.AddScoped<NetWorthMethods>();
builder.Services.AddScoped<SpendingTrackerApi.Services.IPlanningService, SpendingTrackerApi.Services.PlanningService>();
builder.Services.AddScoped<SpendingTrackerApi.Services.IScenarioService, SpendingTrackerApi.Services.ScenarioService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowReactApp");

// Only use HTTPS redirection in production
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Map API endpoints
app.MapTransactionFunctions();
app.MapCategoryFunctions();
app.MapNetWorthFunctions();
SpendingTrackerApi.Endpoints.PlanningEndpoints.MapPlanningEndpoints(app);
SpendingTrackerApi.Endpoints.ScenarioEndpoints.MapScenarioEndpoints(app);

app.Run();
