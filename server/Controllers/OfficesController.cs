using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NaviOffice.Api.Data;
using NaviOffice.Api.Models;

namespace NaviOffice.Api.Controllers;

[ApiController]
[Route("api/offices")]
[Authorize(Policy = "Admin")]
public class OfficesController : ControllerBase
{
    private readonly AppDbContext _db;

    public OfficesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost]
    public async Task<ActionResult<OfficeDto>> Create([FromBody] OfficeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Название офиса обязательно" });
        }

        var maxOrder = await _db.Offices.Select(o => (int?)o.Order).MaxAsync() ?? 0;
        var office = new Office { Id = Guid.NewGuid(), Name = request.Name.Trim(), Order = maxOrder + 1 };
        _db.Offices.Add(office);
        await _db.SaveChangesAsync();
        return Ok(new OfficeDto { Id = office.Id, Name = office.Name, Order = office.Order });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<OfficeDto>> Rename(Guid id, [FromBody] OfficeRequest request)
    {
        var office = await _db.Offices.FindAsync(id);
        if (office == null)
        {
            return NotFound();
        }
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Название офиса обязательно" });
        }
        office.Name = request.Name.Trim();
        await _db.SaveChangesAsync();
        return Ok(new OfficeDto { Id = office.Id, Name = office.Name, Order = office.Order });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var office = await _db.Offices.FindAsync(id);
        if (office == null)
        {
            return NotFound();
        }
        var hasFloors = await _db.Floors.AnyAsync(f => f.OfficeId == id);
        if (hasFloors)
        {
            return Conflict(new { message = "Сначала удалите или перенесите этажи этого офиса" });
        }
        _db.Offices.Remove(office);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
