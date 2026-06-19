using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using volontiamo.api.Auth;
using volontiamo.api.Users;
using volontiamo.domain;

namespace volontiamo.api.tests.L1;

public class UsersEndpointTests : IClassFixture<PostgresWebApplicationFactory>
{
    private readonly HttpClient _client;

    public UsersEndpointTests(PostgresWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static CreateUserRequest ValidCreateRequest(string? emailOverride = null) => new(
        FirstName: "Mario",
        LastName: "Rossi",
        Email: emailOverride ?? $"mario.rossi.{Guid.NewGuid():N}@example.com",
        InitialPassword: "Password!123",
        Phone: "+39 333 1234567",
        DateOfBirth: new DateOnly(1985, 3, 15),
        EnrollmentDate: new DateOnly(2024, 1, 10),
        EndDate: null,
        IsActive: true,
        UserType: UserType.Volontario,
        Occupation: "Ingegnere");

    private async Task AuthenticateAsSeedUserAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new AuthenticateUserRequest(
            PostgresWebApplicationFactory.SeedEmail,
            PostgresWebApplicationFactory.SeedPassword));
        response.EnsureSuccessStatusCode();
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login!.AccessToken);
    }

    [Fact]
    public async Task Users_WithoutBearerToken_ReturnsUnauthorized()
    {
        _client.DefaultRequestHeaders.Authorization = null;

        var response = await _client.GetAsync("/api/v1/users");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_ValidUser_ReturnsCreated()
    {
        await AuthenticateAsSeedUserAsync();
        var request = ValidCreateRequest();

        var response = await _client.PostAsJsonAsync("/api/v1/users", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var user = await response.Content.ReadFromJsonAsync<UserResponse>();
        Assert.NotNull(user);
        Assert.Equal(request.FirstName, user.FirstName);
        Assert.Equal(request.LastName, user.LastName);
        Assert.Equal(request.Email.Trim().ToLowerInvariant(), user.Email);
        Assert.NotEqual(Guid.Empty, user.Id);
    }

    [Fact]
    public async Task Create_InvalidPayload_MissingFirstName_ReturnsValidationProblem()
    {
        await AuthenticateAsSeedUserAsync();
        var request = ValidCreateRequest() with { FirstName = "" };

        var response = await _client.PostAsJsonAsync("/api/v1/users", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ValidationProblemDetails>();
        Assert.NotNull(problem);
        Assert.Contains("firstName", problem.Errors.Keys);
    }

    [Fact]
    public async Task Create_DuplicateEmail_ReturnsConflict()
    {
        await AuthenticateAsSeedUserAsync();
        var email = $"duplicate.{Guid.NewGuid():N}@example.com";
        var request = ValidCreateRequest(email);

        await _client.PostAsJsonAsync("/api/v1/users", request);
        var response = await _client.PostAsJsonAsync("/api/v1/users", request with { FirstName = "Luigi" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task GetById_ExistingUser_ReturnsOk()
    {
        await AuthenticateAsSeedUserAsync();
        var request = ValidCreateRequest();
        var createResponse = await _client.PostAsJsonAsync("/api/v1/users", request);
        var created = await createResponse.Content.ReadFromJsonAsync<UserResponse>();

        var response = await _client.GetAsync($"/api/v1/users/{created!.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = await response.Content.ReadFromJsonAsync<UserResponse>();
        Assert.Equal(created.Id, user!.Id);
    }

    [Fact]
    public async Task GetById_NonExistent_ReturnsNotFound()
    {
        await AuthenticateAsSeedUserAsync();
        var response = await _client.GetAsync($"/api/v1/users/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task List_ReturnsPaginatedResponse()
    {
        await AuthenticateAsSeedUserAsync();
        // Create a few users
        for (int i = 0; i < 3; i++)
            await _client.PostAsJsonAsync("/api/v1/users", ValidCreateRequest());

        var response = await _client.GetAsync("/api/v1/users?page=1&pageSize=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paged = await response.Content.ReadFromJsonAsync<PagedResponse<UserResponse>>();
        Assert.NotNull(paged);
        Assert.Equal(2, paged.Items.Count);
        Assert.True(paged.TotalCount >= 3);
        Assert.Equal(1, paged.Page);
        Assert.Equal(2, paged.PageSize);
    }

    [Fact]
    public async Task Update_ExistingUser_ReturnsOk()
    {
        await AuthenticateAsSeedUserAsync();
        var request = ValidCreateRequest();
        var createResponse = await _client.PostAsJsonAsync("/api/v1/users", request);
        var created = await createResponse.Content.ReadFromJsonAsync<UserResponse>();

        var updateRequest = new UpdateUserRequest(
            FirstName: "Giuseppe",
            LastName: "Verdi",
            Email: created!.Email,
            NewPassword: null,
            Phone: "+39 333 9999999",
            DateOfBirth: new DateOnly(1990, 7, 20),
            EnrollmentDate: new DateOnly(2024, 2, 1),
            EndDate: null,
            IsActive: true,
            UserType: UserType.Lilt,
            Occupation: "Medico");

        var response = await _client.PutAsJsonAsync($"/api/v1/users/{created.Id}", updateRequest);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<UserResponse>();
        Assert.Equal("Giuseppe", updated!.FirstName);
        Assert.Equal("Verdi", updated.LastName);
    }

    [Fact]
    public async Task Update_NonExistent_ReturnsNotFound()
    {
        await AuthenticateAsSeedUserAsync();
        var updateRequest = new UpdateUserRequest(
            FirstName: "Test", LastName: "Test", Email: "test@test.com",
            NewPassword: null,
            Phone: null, DateOfBirth: null, EnrollmentDate: DateOnly.FromDateTime(DateTime.Today),
            EndDate: null, IsActive: true, UserType: UserType.Volontario, Occupation: null);

        var response = await _client.PutAsJsonAsync($"/api/v1/users/{Guid.NewGuid()}", updateRequest);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_ExistingUser_ReturnsNoContent()
    {
        await AuthenticateAsSeedUserAsync();
        var request = ValidCreateRequest();
        var createResponse = await _client.PostAsJsonAsync("/api/v1/users", request);
        var created = await createResponse.Content.ReadFromJsonAsync<UserResponse>();

        var response = await _client.DeleteAsync($"/api/v1/users/{created!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Delete_NonExistent_ReturnsNotFound()
    {
        await AuthenticateAsSeedUserAsync();
        var response = await _client.DeleteAsync($"/api/v1/users/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_ExcludesFromList()
    {
        await AuthenticateAsSeedUserAsync();
        var request = ValidCreateRequest();
        var createResponse = await _client.PostAsJsonAsync("/api/v1/users", request);
        var created = await createResponse.Content.ReadFromJsonAsync<UserResponse>();

        await _client.DeleteAsync($"/api/v1/users/{created!.Id}");

        var getResponse = await _client.GetAsync($"/api/v1/users/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task Create_InvalidDates_EndDateBeforeEnrollment_ReturnsValidationProblem()
    {
        await AuthenticateAsSeedUserAsync();
        var request = ValidCreateRequest() with
        {
            EnrollmentDate = new DateOnly(2024, 6, 1),
            EndDate = new DateOnly(2024, 1, 1)
        };

        var response = await _client.PostAsJsonAsync("/api/v1/users", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_ThenLoginWithNewUser_ReturnsTokenAndMe()
    {
        await AuthenticateAsSeedUserAsync();
        var request = ValidCreateRequest();
        var createResponse = await _client.PostAsJsonAsync("/api/v1/users", request);
        createResponse.EnsureSuccessStatusCode();

        _client.DefaultRequestHeaders.Authorization = null;
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", new AuthenticateUserRequest(request.Email, request.InitialPassword));

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var login = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(login);
        Assert.False(string.IsNullOrWhiteSpace(login!.AccessToken));
        Assert.Equal(request.Email.Trim().ToLowerInvariant(), login.User.Email);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.AccessToken);
        var meResponse = await _client.GetAsync("/api/v1/auth/me");

        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        var me = await meResponse.Content.ReadFromJsonAsync<AuthenticatedUserResponse>();
        Assert.Equal(login.User.Id, me!.Id);
        Assert.Equal(UserType.Volontario, me.UserType);
    }
}
