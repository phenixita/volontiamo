using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace volontiamo.api.Users;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/users")
            .WithTags("Users");

        group.MapPost("/", CreateUser);
        group.MapGet("/", ListUsers);
        group.MapGet("/{id:guid}", GetUser);
        group.MapPut("/{id:guid}", UpdateUser);
        group.MapDelete("/{id:guid}", DeleteUser);
    }

    private static async Task<IResult> CreateUser(
        [FromBody] CreateUserRequest request,
        [FromServices] UserService service,
        CancellationToken ct)
    {
        var result = await service.CreateAsync(request, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Created($"/api/v1/users/{result.Value!.Id}", result.Value),
            ResultStatus.Conflict => Results.Problem(
                detail: result.ErrorMessage,
                statusCode: 409,
                title: "Conflict"),
            ResultStatus.ValidationError => Results.ValidationProblem(
                result.Errors.GroupBy(e => e.Field)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Message).ToArray())),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> ListUsers(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromServices] UserService service,
        CancellationToken ct)
    {
        var result = await service.ListAsync(page ?? 1, pageSize ?? 10, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetUser(
        Guid id,
        [FromServices] UserService service,
        CancellationToken ct)
    {
        var result = await service.GetByIdAsync(id, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(result.Value),
            ResultStatus.NotFound => Results.Problem(
                detail: "User not found.",
                statusCode: 404,
                title: "Not Found"),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> UpdateUser(
        Guid id,
        [FromBody] UpdateUserRequest request,
        [FromServices] UserService service,
        CancellationToken ct)
    {
        var result = await service.UpdateAsync(id, request, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.Ok(result.Value),
            ResultStatus.NotFound => Results.Problem(
                detail: "User not found.",
                statusCode: 404,
                title: "Not Found"),
            ResultStatus.Conflict => Results.Problem(
                detail: result.ErrorMessage,
                statusCode: 409,
                title: "Conflict"),
            ResultStatus.ValidationError => Results.ValidationProblem(
                result.Errors.GroupBy(e => e.Field)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Message).ToArray())),
            _ => Results.StatusCode(500)
        };
    }

    private static async Task<IResult> DeleteUser(
        Guid id,
        [FromServices] UserService service,
        CancellationToken ct)
    {
        var result = await service.DeleteAsync(id, ct);
        return result.Status switch
        {
            ResultStatus.Ok => Results.NoContent(),
            ResultStatus.NotFound => Results.Problem(
                detail: "User not found.",
                statusCode: 404,
                title: "Not Found"),
            _ => Results.StatusCode(500)
        };
    }
}
